"use client";

import { useState, useEffect, useCallback } from "react";
import type { AutomationLog } from "@/services/supabase";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

// Common IANA timezone options
const TIMEZONES = [
  { label: "UTC",                     value: "UTC" },
  { label: "Eastern  (New York)",     value: "America/New_York" },
  { label: "Central  (Chicago)",      value: "America/Chicago" },
  { label: "Mountain (Denver)",       value: "America/Denver" },
  { label: "Pacific  (Los Angeles)",  value: "America/Los_Angeles" },
  { label: "London",                  value: "Europe/London" },
  { label: "Paris / Berlin",          value: "Europe/Paris" },
  { label: "Dubai",                   value: "Asia/Dubai" },
  { label: "Mumbai",                  value: "Asia/Kolkata" },
  { label: "Tokyo",                   value: "Asia/Tokyo" },
  { label: "Sydney",                  value: "Australia/Sydney" },
];

interface ScheduleData {
  active: boolean;
  run_times: string[];
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

function getLocalTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [editTimes, setEditTimes] = useState<string[]>(["06:00", "12:00", "18:00"]);
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [lastLog, setLastLog] = useState<AutomationLog | null>(null);
  const [localTime, setLocalTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [replenishing, setReplenishing] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, logRes] = await Promise.all([
        fetch("/api/schedule", { headers: getAuthHeaders() }),
        fetch("/api/logs?limit=1", { headers: getAuthHeaders() }),
      ]);
      if (schedRes.ok) {
        const data = (await schedRes.json()) as ScheduleData;
        setSchedule(data);
        setEditTimes(data.run_times);
        setEditTimezone(data.timezone);
      }
      if (logRes.ok) {
        const logData = (await logRes.json()) as { logs: AutomationLog[] };
        setLastLog(logData.logs[0] ?? null);
      }
    } catch {
      showToast("Failed to load schedule settings", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Live clock in the configured timezone
  useEffect(() => {
    setLocalTime(getLocalTime(editTimezone));
    const id = setInterval(() => setLocalTime(getLocalTime(editTimezone)), 1000);
    return () => clearInterval(id);
  }, [editTimezone]);

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

  async function saveSchedule() {
    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ run_times: editTimes, timezone: editTimezone }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to save");
      }
      const data = (await res.json()) as ScheduleData;
      setSchedule(data);
      showToast("Schedule saved", true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setSaving(false);
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
      void fetchAll();
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

  function updateTime(index: number, value: string) {
    const next = [...editTimes];
    next[index] = value;
    setEditTimes(next);
  }

  function addTime() {
    if (editTimes.length < 5) setEditTimes([...editTimes, "09:00"]);
  }

  function removeTime(index: number) {
    if (editTimes.length > 1) setEditTimes(editTimes.filter((_, i) => i !== index));
  }

  const isDirty =
    schedule !== null &&
    (JSON.stringify(editTimes.slice().sort()) !== JSON.stringify(schedule.run_times.slice().sort()) ||
      editTimezone !== schedule.timezone);

  const logStatusColor: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
    draft:   "bg-amber/10 text-amber ring-amber/30",
    held:    "bg-orange-500/10 text-orange-400 ring-orange-500/30",
    error:   "bg-red-500/10 text-red-400 ring-red-500/30",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Schedule</h1>
        <p className="mt-1 text-sm text-muted">Manage automation schedule, run times, and timezone</p>
      </div>

      {/* Scheduler toggle */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                schedule?.active ? "bg-emerald-500/10" : "bg-red-500/10"
              }`}
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={schedule?.active ? "#34d399" : "#f87171"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-white">Automation Scheduler</div>
              <div className="mt-0.5 text-sm text-muted">
                {loading
                  ? "Loading…"
                  : schedule?.active
                  ? "Running — pipeline fires on the configured schedule"
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
            {toggling ? "Updating…" : schedule?.active ? "Stop Scheduler" : "Start Scheduler"}
          </button>
        </div>
      </div>

      {/* Run time editor */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f5a623"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="font-semibold text-white">Run Schedule</span>
          </div>
          {/* Live clock */}
          <div className="text-right">
            <div className="font-mono text-sm text-white">{localTime || "—"}</div>
            <div className="text-xs text-muted">{editTimezone}</div>
          </div>
        </div>

        {/* Timezone selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-muted">Timezone</label>
          <select
            value={editTimezone}
            onChange={(e) => setEditTimezone(e.target.value)}
            className="w-full rounded-lg border border-edge bg-raised px-3 py-2.5 text-sm text-white transition-colors focus:border-amber/50 focus:outline-none focus:ring-2 focus:ring-amber/10"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-raised">
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Run times */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs text-muted">
            Run times — 24-hour format, in the timezone above
          </label>
          <div className="space-y-2">
            {editTimes.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  className="flex-1 rounded-lg border border-edge bg-raised px-3 py-2.5 text-sm text-white transition-colors focus:border-amber/50 focus:outline-none focus:ring-2 focus:ring-amber/10"
                />
                {editTimes.length > 1 && (
                  <button
                    onClick={() => removeTime(i)}
                    className="rounded-lg border border-edge px-3 py-2.5 text-xs text-muted transition-colors hover:border-red-500/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {editTimes.length < 5 && (
            <button
              onClick={addTime}
              className="mt-2 text-xs text-amber transition-colors hover:text-amber/80"
            >
              + Add run time
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted">
            Cron fires every hour — the pipeline only executes at the times configured above.
          </p>
          <button
            onClick={saveSchedule}
            disabled={saving || !isDirty}
            className="shrink-0 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Schedule"}
          </button>
        </div>
      </div>

      {/* Last pipeline run */}
      {lastLog && (
        <div className="rounded-xl border border-edge bg-surface p-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
            Last Pipeline Run
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${
                  logStatusColor[lastLog.status] ?? logStatusColor.error
                }`}
              >
                {lastLog.status}
              </span>
              {lastLog.confidence_score != null && (
                <span className="text-sm text-muted">
                  Confidence:{" "}
                  <span className="font-medium text-white">{lastLog.confidence_score}</span>
                </span>
              )}
              {lastLog.seo_checks_passed != null && (
                <span className="text-sm text-muted">
                  SEO:{" "}
                  <span className="font-medium text-white">
                    {lastLog.seo_checks_passed}/15
                  </span>
                </span>
              )}
            </div>
            <span className="text-xs text-muted">
              {new Date(lastLog.created_at).toLocaleString()}
            </span>
          </div>
          {lastLog.error_message && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {lastLog.error_message}
            </p>
          )}
          {lastLog.revision_notes && (
            <p className="mt-2 text-xs text-muted">{lastLog.revision_notes}</p>
          )}
        </div>
      )}

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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {replenishing ? "Generating topics…" : "Replenish Queue"}
          </button>
        </div>
      </div>

      {/* Supabase migration note */}
      <div className="rounded-xl border border-amber/20 bg-amber/5 p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber">
          One-time Supabase setup required
        </p>
        <p className="mb-3 text-sm text-muted">
          Run this in your Supabase SQL editor to enable scheduler settings:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-bg p-4 font-mono text-xs leading-relaxed text-white">{`CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('scheduler_active', 'true')
ON CONFLICT (key) DO NOTHING;`}</pre>
      </div>

      {toast && <Toast message={toast.message} ok={toast.ok} />}
    </div>
  );
}
