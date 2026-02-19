"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function OverviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const links = [
  { href: "/dashboard",          label: "Overview", Icon: OverviewIcon },
  { href: "/dashboard/schedule", label: "Schedule", Icon: ScheduleIcon },
  { href: "/dashboard/queue",    label: "Queue",    Icon: QueueIcon },
  { href: "/dashboard/review",   label: "Review",   Icon: ReviewIcon },
  { href: "/dashboard/history",  label: "History",  Icon: HistoryIcon },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [schedulerActive, setSchedulerActive] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/schedule", { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d: { active?: boolean }) => setSchedulerActive(d.active ?? true))
        .catch(() => setSchedulerActive(null));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [pathname]);

  function handleSignOut() {
    localStorage.removeItem("dashboard_password");
    router.push("/login");
  }

  return (
    <div className="sticky top-0 z-50 border-b border-edge bg-surface">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">
              Jesse A. Eisenbalm
            </div>
            <div className="text-[11px] leading-tight text-muted">
              Automation Dashboard
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {schedulerActive !== null && (
            <div className="flex items-center gap-2 rounded-full border border-edge px-3 py-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  schedulerActive ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span className="text-xs text-muted">
                {schedulerActive ? "Active" : "Stopped"}
              </span>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-muted transition-colors hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex px-4">
        {links.map(({ href, label, Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-amber text-amber"
                  : "border-transparent text-muted hover:text-white"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
