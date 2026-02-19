"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import type { QueueItem, AutomationLog } from "@/services/supabase";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function BoltIcon({ color = "#f5a623" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function ZapAddIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-edge bg-surface p-5">
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-1 truncate text-3xl font-bold text-white">{value}</div>
        <div className="mt-1 text-xs text-muted">{sublabel}</div>
      </div>
      <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber/10">
        {icon}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, ok }: { message: string; ok: boolean }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-card-md ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      {message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [schedulerActive, setSchedulerActive] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [replenishLoading, setReplenishLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [qRes, lRes, sRes] = await Promise.all([
        fetch("/api/queue", { headers }),
        fetch("/api/logs?limit=50", { headers }),
        fetch("/api/schedule", { headers }),
      ]);
      if (qRes.ok) {
        const d = (await qRes.json()) as { items: QueueItem[] };
        setQueueItems(d.items ?? []);
      }
      if (lRes.ok) {
        const d = (await lRes.json()) as { logs: AutomationLog[] };
        setLogs(d.logs ?? []);
      }
      if (sRes.ok) {
        const d = (await sRes.json()) as { active: boolean };
        setSchedulerActive(d.active ?? true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const pendingCount = queueItems.filter((i) => i.status === "pending").length;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const publishedToday = logs.filter(
    (l) => l.status === "success" && new Date(l.created_at).getTime() >= todayStart
  ).length;

  const thisWeek = logs.filter(
    (l) =>
      (l.status === "success" || l.status === "draft") &&
      new Date(l.created_at).getTime() >= weekStart
  ).length;

  const recentLogs = logs.slice(0, 8);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function toggleScheduler() {
    setSchedulerLoading(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ active: !schedulerActive }),
      });
      if (!res.ok) throw new Error("Failed");
      const d = (await res.json()) as { active: boolean };
      setSchedulerActive(d.active);
      showToast(d.active ? "Scheduler started" : "Scheduler stopped", true);
    } catch {
      showToast("Failed to update scheduler", false);
    } finally {
      setSchedulerLoading(false);
    }
  }

  async function runPipelineNow() {
    setPipelineLoading(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const d = (await res.json()) as { status?: string; error?: string };
      if (d.error) throw new Error(d.error);
      showToast(`Pipeline complete — ${d.status ?? "done"}`, true);
      await fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Pipeline failed", false);
    } finally {
      setPipelineLoading(false);
    }
  }

  async function replenishQueue() {
    setReplenishLoading(true);
    try {
      const res = await fetch("/api/queue/replenish", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const d = (await res.json()) as { added?: number; message?: string; error?: string };
      if (d.error) throw new Error(d.error);
      showToast(d.message ?? `Added ${d.added ?? 0} topics`, true);
      await fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Replenish failed", false);
    } finally {
      setReplenishLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Queue Size"
          value={loading ? "—" : pendingCount}
          sublabel="Posts waiting"
          icon={<ListIcon />}
        />
        <StatCard
          label="Published Today"
          value={loading ? "—" : publishedToday}
          sublabel="Posts sent"
          icon={<SendIcon />}
        />
        <StatCard
          label="This Week"
          value={loading ? "—" : thisWeek}
          sublabel="Total published"
          icon={<ChartIcon />}
        />
        <StatCard
          label="Scheduler"
          value={schedulerActive ? "Active" : "Stopped"}
          sublabel={schedulerActive ? "Running on schedule" : "Manual mode"}
          icon={<BoltIcon color={schedulerActive ? "#f5a623" : "#8891a8"} />}
        />
      </div>

      {/* Control Panel */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Control Panel</h2>
        <div className="space-y-3">
          <button
            onClick={toggleScheduler}
            disabled={schedulerLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              schedulerActive
                ? "border-red-700/40 bg-red-900/20 text-red-400 hover:bg-red-900/30"
                : "border-green-700/40 bg-green-900/20 text-green-400 hover:bg-green-900/30"
            }`}
          >
            {schedulerActive ? <StopIcon /> : <PlayIcon />}
            {schedulerLoading
              ? "Updating…"
              : schedulerActive
              ? "Stop Scheduler"
              : "Start Scheduler"}
          </button>

          <button
            onClick={runPipelineNow}
            disabled={pipelineLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-50"
          >
            <PlayIcon />
            {pipelineLoading ? "Running…" : "Run Pipeline Now"}
          </button>

          <button
            onClick={replenishQueue}
            disabled={replenishLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-50"
          >
            <ZapAddIcon />
            {replenishLoading ? "Generating topics…" : "Replenish Queue"}
          </button>

          <button
            onClick={fetchAll}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-raised px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-white"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Schedule */}
        <div className="rounded-xl border border-edge bg-surface p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10">
              <ClockIcon />
            </div>
            <span className="font-semibold text-white">Schedule</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Daily runs</span>
              <span className="font-medium text-white">3×</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Times (UTC)</span>
              <span className="font-mono text-white">06:00 · 12:00 · 18:00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Timezone</span>
              <span className="font-medium text-white">UTC</span>
            </div>
          </div>
        </div>

        {/* Blog API status */}
        <div className="rounded-xl border border-edge bg-surface p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <GlobeIcon />
            </div>
            <span className="font-semibold text-white">Blog API</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-edge bg-raised p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckIcon />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Connected</div>
              <div className="text-xs text-muted">Ready to publish</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent runs */}
      {recentLogs.length > 0 && (
        <div className="rounded-xl border border-edge bg-surface overflow-hidden">
          <div className="border-b border-edge px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white">Recent Runs</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Confidence</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">SEO</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {recentLogs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-raised/50">
                  <td className="px-5 py-3"><StatusBadge status={log.status} /></td>
                  <td className="px-5 py-3">
                    {log.confidence_score != null ? (
                      <ConfidenceBar score={log.confidence_score} size="sm" />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted">
                    {log.seo_checks_passed != null ? `${log.seo_checks_passed}/15` : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} ok={toast.ok} />}
    </div>
  );
}
