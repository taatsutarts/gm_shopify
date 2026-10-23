"use client";

// app/orders/page.jsx

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/middleware"; // <- change to wherever your Supabase client is exported

/* ---------- formatting helpers ---------- */

const pad = (n) => String(n).padStart(2, "0");

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-10-21" -> "21/10/2026"
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

// "05:00PM-07:00PM" -> "5PM-7PM"   ("07:30PM" -> "7:30PM")
function fmtSlot(slot) {
  if (!slot) return "";
  return slot.replace(/\b0?(\d{1,2}):(\d{2})\s*([AP]M)/gi, (_, h, m, ap) =>
    m === "00" ? `${h}${ap.toUpperCase()}` : `${h}:${m}${ap.toUpperCase()}`
  );
}

// "7738801114" -> "+91 77388 01114"
function fmtPhone(p) {
  if (!p) return "";
  let d = String(p).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return String(p);
}

const itemLine = (i) =>
  `${i.title}${i.variant ? ` - ${i.variant}` : ""} x ${i.qty}`;

function addressLines(o) {
  return [
    o.ship_name || o.customer_name,
    o.address1,
    o.address2,
    [o.zip, o.city, o.province_code].filter(Boolean).join(" "),
    o.country,
    fmtPhone(o.phone),
  ].filter(Boolean);
}

function dateLine(o) {
  return [fmtDate(o.delivery_date), o.delivery_day].filter(Boolean).join(", ");
}

function buildCopyText(o) {
  const head = [o.customer_name || o.ship_name, dateLine(o), fmtSlot(o.delivery_slot)]
    .filter(Boolean)
    .join("\n");
  const items = (o.items || []).map(itemLine).join("\n");
  const address = ["Delivery address", ...addressLines(o)].join("\n");
  return [head, items, address].filter(Boolean).join("\n\n");
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
    return ok;
  }
}

/* ---------- icons ---------- */

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/* ---------- small ui pieces ---------- */

const Chip = ({ children, tone = "green" }) => (
  <em
    className={`rounded-full px-2 py-0.5 text-xs font-semibold not-italic ${
      tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800"
    }`}
  >
    {children}
  </em>
);

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-600 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

/* ---------- page ---------- */

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("shopify_orders")
      .select("*")
      .order("placed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);

    if (error) setError(error.message);
    else {
      setError(null);
      setOrders(data ?? []);
    }
    setLoading(false);
  }, []);

  // initial load + live updates
  useEffect(() => {
    load();
    const channel = supabase
      .channel("orders-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopify_orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const selected = orders.find((o) => o.id === selectedId) || null;

  // close on Escape, lock page scroll while the popup is open
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const openOrder = (id) => {
    setCopied(false);
    setSelectedId(id);
  };

  const handleCopy = async () => {
    if (!selected) return;
    const ok = await copyToClipboard(buildCopyText(selected));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const today = todayISO();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto mb-6 max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight">Shopify Orders</h1>
        {!loading && !error && (
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} {orders.length === 1 ? "order" : "orders"}, newest first
          </p>
        )}
      </header>

      {loading && <p className="mx-auto max-w-6xl text-slate-500">Loading orders…</p>}

      {error && (
        <p className="mx-auto max-w-6xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn’t load orders: {error}. Check the Supabase connection and that the
          orders table has a read policy for your login.
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="mx-auto max-w-6xl text-slate-500">
          No orders yet. New paid orders from Shopify appear here as soon as they arrive.
        </p>
      )}

      <section className="mx-auto grid max-w-6xl gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {orders.map((o) => {
          const count = (o.items || []).length;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => openOrder(o.id)}
              className="flex w-full flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <span className="flex w-full items-start justify-between gap-3">
                <span className="text-base font-semibold leading-snug">
                  {o.customer_name || o.ship_name || "Unnamed"}
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  {o.order_name}
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {dateLine(o) || "No delivery date"}
                {o.delivery_date === today && <Chip>Today</Chip>}
              </span>

              {o.delivery_slot && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <ClockIcon />
                  {fmtSlot(o.delivery_slot)}
                </span>
              )}

              <span className="mt-1 flex w-full items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  {count} {count === 1 ? "item" : "items"}
                </span>
                {o.is_test && <Chip tone="amber">Test</Chip>}
              </span>
            </button>
          );
        })}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Order ${selected.order_name || ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="mb-1.5 text-2xl font-semibold leading-tight">
                  {selected.customer_name || selected.ship_name}
                </h2>
                <p className="text-[15px] text-slate-500">{dateLine(selected)}</p>
                {selected.delivery_slot && (
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                    <ClockIcon />
                    {fmtSlot(selected.delivery_slot)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className={
                    copied
                      ? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 text-white"
                      : iconBtn
                  }
                  onClick={handleCopy}
                  aria-label="Copy order details"
                  title="Copy order details"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                  title="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <span
              className="mt-1.5 block min-h-[18px] text-right text-xs text-emerald-700"
              aria-live="polite"
            >
              {copied ? "Copied to clipboard" : ""}
            </span>

            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-4">
              {(selected.items || []).map((i, idx) => (
                <li key={idx} className="text-[15px] leading-relaxed">
                  {itemLine(i)}
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Delivery address
              </h3>
              {addressLines(selected).map((l, idx) => (
                <p key={idx} className="text-[15px] leading-relaxed">
                  {l}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}