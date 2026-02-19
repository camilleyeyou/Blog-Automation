"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/queue", label: "Queue" },
  { href: "/dashboard/review", label: "Review" },
  { href: "/dashboard/history", label: "History" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  function handleSignOut() {
    localStorage.removeItem("dashboard_password");
    router.push("/login");
  }

  return (
    <aside className="w-52 shrink-0 border-r border-beige bg-cream flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-beige">
        <div className="text-[13px] font-semibold tracking-tight text-ink leading-snug">
          Jesse A. Eisenbalm
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-stone">
          Blog Automation
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-ink text-cream font-medium"
                  : "text-charcoal/60 hover:text-ink hover:bg-beige/60"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-5 border-t border-beige space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-stone">Pipeline active</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[11px] text-stone hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
