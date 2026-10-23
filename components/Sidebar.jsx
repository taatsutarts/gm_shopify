"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

const NAV = [

  { href: "/", label: "Home", icon: "🏠" },
  { href: "/shopify-orders", label: "Shopify-Orders", icon: "🏠" }
  
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({});

  // must stay AFTER all hooks
  if (pathname === "/login") return null;

  async function handleLogout() {
    await createClient().auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (active) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-blue-600 text-white" : "hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-slate-900 px-4 text-white md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-xl"
        >
          ☰
        </button>
        <span className="font-semibold tracking-wide">GOURMAISON</span>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="text-lg font-bold tracking-widest text-white">TAATSU</p>
          <p className="text-xs text-slate-400">Sales & Orders</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={linkClass(isActive(item.href))}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            }

            const groupActive = pathname.startsWith(item.base);
            const isOpen = expanded[item.label] ?? groupActive;

            return (
              <div key={item.label}>
                <button
                  onClick={() =>
                    setExpanded({ ...expanded, [item.label]: !isOpen })
                  }
                  className={`${linkClass(false)} w-full ${
                    groupActive ? "text-white" : ""
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs">{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen && (
                  <div className="ml-5 mt-1 space-y-1 border-l border-slate-700 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive(child.href)
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 px-3 py-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-slate-800 hover:text-white"
          >
            <span className="text-base">🚪</span>
            Log out
          </button>
          <p className="px-3 pt-2 text-xs text-slate-500">v1.0</p>
        </div>
      </aside>
    </>
  );
}