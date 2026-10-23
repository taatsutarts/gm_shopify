// app/api/webhooks/shopify/route.js
// The path must match the URL you registered in Shopify (Settings -> Notifications -> Webhooks).

import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-only client. Uses the service role key, so it must NEVER have a NEXT_PUBLIC_ prefix.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function verifyShopify(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// EDP sends dates as DD/MM/YYYY text -> "YYYY-MM-DD"
function toISODate(s) {
  const m = String(s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

function getAttr(attrs, label) {
  const hit = attrs.find(
    (a) => String(a?.name ?? "").trim().toLowerCase() === label
  );
  const v = hit?.value;
  return v == null ? null : String(v).trim();
}

function buildRow(order) {
  const attrs = Array.isArray(order.note_attributes) ? order.note_attributes : [];
  const ship = order.shipping_address ?? null;
  const bill = order.billing_address ?? null;
  const cust = order.customer ?? null;

  const buyerName =
    [cust?.first_name, cust?.last_name].filter(Boolean).join(" ") ||
    bill?.name ||
    ship?.name ||
    null;

  return {
    shopify_order_id: String(order.id),
    order_name: order.name ?? null,
    order_number: order.order_number ?? null,

    customer_name: buyerName,
    email: order.email ?? order.contact_email ?? cust?.email ?? null,
    // phone is usually only inside the address blocks
    phone: ship?.phone ?? bill?.phone ?? order.phone ?? cust?.phone ?? null,

    delivery_date: toISODate(getAttr(attrs, "delivery/pickup date")),
    delivery_day: getAttr(attrs, "delivery/pickup day"),
    delivery_slot: getAttr(attrs, "delivery/pickup time"),
    delivery_method: order.shipping_lines?.[0]?.title ?? null,

    items: (order.line_items ?? []).map((l) => ({
      title: l.title,
      variant:
        l.variant_title && l.variant_title !== "Default Title"
          ? l.variant_title
          : null,
      qty: l.quantity,
      sku: l.sku ?? null,
    })),

    ship_name: ship?.name ?? null,
    address1: ship?.address1 ?? null,
    address2: ship?.address2 ?? null,
    city: ship?.city ?? null,
    province: ship?.province ?? null,
    province_code: ship?.province_code ?? null,
    zip: ship?.zip ?? null,
    country: ship?.country ?? null,
    latitude: ship?.latitude ?? null,
    longitude: ship?.longitude ?? null,

    total_price: order.total_price != null ? Number(order.total_price) : null,
    currency: order.currency ?? null,
    financial_status: order.financial_status ?? null,
    is_test: Boolean(order.test),

    placed_at: order.created_at ?? new Date().toISOString(),
  };
}

export async function POST(req) {
  // Raw body is required for the signature check, so read text first and parse after.
  const rawBody = await req.text();

  if (!verifyShopify(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let order;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const row = buildRow(order);

  // Upsert on the Shopify id: retries and duplicate deliveries just overwrite the same row.
  const { error } = await getSupabase()
    .from("shopify_orders")
    .upsert(row, { onConflict: "shopify_order_id" });

  if (error) {
    // Don't log the row, it contains customer details.
    console.error("Supabase upsert failed:", error.message);
    // Non-2xx makes Shopify retry later.
    return new NextResponse("Database error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}