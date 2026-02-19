"use client";

import { useState, useEffect, useCallback } from "react";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

interface ScheduleData {
  active: boolean;
  times: string[];
  timezone: string;
}

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

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [replenishing, setReplenishing] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      const data = (await res.json()) as ScheduleData;
      setSchedule(data);
    } catch {
      showToast("Failed to load schedule settings", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  async function toggleScheduler() {
    if (!schedule) return;
    setToggling(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ active: !schedule.active }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as ScheduleData;
      setSchedule(data);
      showToast(data.active ? "Scheduler started" : "Scheduler stopped", true);
    } catch {
      showToast("Failed to update scheduler", false);
    } finally {
      setToggling(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const d = (await res.json()) as { status?: string; error?: string };
      if (d.error) throw new Error(d.error);
      showToast(`Pipeline complete — ${d.status ?? "done"}`, true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Pipeline failed", false);
    } finally {
      setRunning(false);
    }
  }

  async function replenishQueue() {
    setReplenishing(true);
    try {
      const res = await fetch("/api/queue/replenish", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const d = (await res.json()) as { added?: number; message?: string; error?: string };
      if (d.error) throw new Error(d.error);
      showToast(d.message ?? `Added ${d.added ?? 0} topics`, true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Replenish failed", false);
    } finally {
      setReplenishing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Schedule</h1>
        <p className="mt-1 text-sm text-muted">Manage the automation scheduler and cron settings</p>
      </div>

      {/* Scheduler status + toggle */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                schedule?.active ? "bg-emerald-500/10" : "bg-red-500/10"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={schedule?.active ? "#34d399" : "#f87171"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-white">Automation Scheduler</div>
              <div className="mt-0.5 text-sm text-muted">
                {loading
                  ? "Loading…"
                  : schedule?.active
                  ? "Running — pipeline fires automatically 3× daily"
                  : "Stopped — cron triggers are ignored"}
              </div>
            </div>
          </div>

          <button
            onClick={toggleScheduler}
            disabled={toggling || loading}
            className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              schedule?.active
                ? "border-red-700/40 bg-red-900/20 text-red-400 hover:bg-red-900/30"
                : "border-green-700/40 bg-green-900/20 text-green-400 hover:bg-green-900/30"
            }`}
          >
            {toggling
              ? "Updating…"
              : schedule?.active
              ? "Stop Scheduler"
              : "Start Scheduler"}
          </button>
        </div>
      </div>

      {/* Cron schedule */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <span className="font-semibold text-white">Cron Schedule</span>
        </div>

        <div className="divide-y divide-edge rounded-lg border border-edge overflow-hidden">
          <div className="flex items-center justify-between bg-raised/40 px-4 py-3 text-sm">
            <span className="text-muted">Frequency</span>
            <span className="font-medium text-white">3 runs per day</span>
          </div>
          {(schedule?.times ?? ["06:00", "12:00", "18:00"]).map((t, i) => (
            <div key={t} className="flex items-center justify-between bg-raised/40 px-4 py-3 text-sm">
              <span className="text-muted">Run {i + 1}</span>
              <span className="font-mono text-white">{t} UTC</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-raised/40 px-4 py-3 text-sm">
            <span className="text-muted">Timezone</span>
            <span className="font-medium text-white">{schedule?.timezone ?? "UTC"}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Schedule is defined in <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-amber">vercel.json</code> and managed by Vercel Cron Jobs. Stopping the scheduler prevents cron runs without modifying the cron config.
        </p>
      </div>

      {/* Manual actions */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Manual Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {running ? "Running…" : "Run Pipeline Now"}
          </button>

          <button
            onClick={replenishQueue}
            disabled={replenishing}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {replenishing ? "Generating topics…" : "Replenish Queue"}
          </button>
        </div>
      </div>

      {/* SQL migration note */}
      <div className="rounded-xl border border-amber/20 bg-amber/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber mb-2">
          One-time Supabase setup required
        </p>
        <p className="text-sm text-muted mb-3">
          Run this SQL in your Supabase SQL editor to enable the scheduler toggle:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-bg p-4 text-xs text-white font-mono leading-relaxed">
{`CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('scheduler_active', 'true')
ON CONFLICT (key) DO NOTHING;`}
        </pre>
      </div>

      {toast && <Toast message={toast.message} ok={toast.ok} />}
    </div>
  );
}
