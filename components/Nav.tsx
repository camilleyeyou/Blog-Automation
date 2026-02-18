"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/queue", label: "Queue" },
  { href: "/dashboard/review", label: "Review" },
  { href: "/dashboard/history", label: "History" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-beige bg-cream">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-0">
        <span className="mr-6 py-4 text-sm font-semibold tracking-tight text-ink">
          Jesse A. Eisenbalm
        </span>
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-4 text-sm transition-colors ${
                active
                  ? "border-b-2 border-ink font-medium text-ink"
                  : "text-stone hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
