"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AutomationLog } from "@/services/supabase";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

const TIMEZONES = [
  { label: "UTC",                    value: "UTC" },
  { label: "New York (ET)",          value: "America/New_York" },
  { label: "Chicago (CT)",           value: "America/Chicago" },
  { label: "Denver (MT)",            value: "America/Denver" },
  { label: "Los Angeles (PT)",       value: "America/Los_Angeles" },
  { label: "London (GMT/BST)",       value: "Europe/London" },
  { label: "Paris (CET/CEST)",       value: "Europe/Paris" },
  { label: "Dubai (GST)",            value: "Asia/Dubai" },
  { label: "Singapore (SGT)",        value: "Asia/Singapore" },
  { label: "Tokyo (JST)",            value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)",     value: "Australia/Sydney" },
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

function LiveClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      try {
        setTime(
          new Date().toLocaleTimeString("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        );
      } catch {
        setTime("--:--:--");
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timezone]);

  return (
    <span className="font-mono text-white tabular-nums">{time}</span>
  );
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [lastLog, setLastLog] = useState<AutomationLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [replenishing, setReplenishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  // Editable schedule state (local before save)
  const [editTimes, setEditTimes] = useState<string[]>([]);
  const [editTz, setEditTz] = useState("UTC");
  const dirty = useRef(false);

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
        if (!dirty.current) {
          setEditTimes(data.run_times);
          setEditTz(data.timezone);
        }
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
    dirty.current = false;
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ run_times: editTimes, timezone: editTz }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Save failed");
      }
      const data = (await res.json()) as ScheduleData;
      setSchedule(data);
      setEditTimes(data.run_times);
      setEditTz(data.timezone);
      showToast("Schedule saved — Railway notified", true);
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

  function addTime() {
    if (editTimes.length >= 5) return;
    dirty.current = true;
    setEditTimes((prev) => [...prev, "09:00"]);
  }

  function removeTime(index: number) {
    if (editTimes.length <= 1) return;
    dirty.current = true;
    setEditTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTime(index: number, value: string) {
    dirty.current = true;
    setEditTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  const logStatusColor: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
    draft:   "bg-amber/10 text-amber ring-amber/30",
    held:    "bg-orange-500/10 text-orange-400 ring-orange-500/30",
    error:   "bg-red-500/10 text-red-400 ring-red-500/30",
  };

  const hasUnsavedChanges =
    schedule !== null &&
    (JSON.stringify(editTimes) !== JSON.stringify(schedule.run_times) ||
      editTz !== schedule.timezone);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Schedule</h1>
        <p className="mt-1 text-sm text-muted">Manage the automation scheduler</p>
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
                  ? `Running — ${schedule.run_times.length}× daily`
                  : "Stopped — pipeline will not fire until restarted"}
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

      {/* Schedule editor */}
      <div className="rounded-xl border border-edge bg-surface p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f5a623"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1">
            <span className="font-semibold text-white">Run Schedule</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Now in {TIMEZONES.find((z) => z.value === editTz)?.label ?? editTz}:</span>
            <LiveClock timezone={editTz} />
          </div>
        </div>

        {/* Timezone */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted">Timezone</label>
          <select
            value={editTz}
            onChange={(e) => { dirty.current = true; setEditTz(e.target.value); }}
            className="w-full rounded-lg border border-edge bg-raised px-3 py-2 text-sm text-white focus:border-amber/50 focus:outline-none"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        {/* Run times */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Run Times ({editTimes.length}/5)
          </label>
          <div className="space-y-2">
            {editTimes.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  className="flex-1 rounded-lg border border-edge bg-raised px-3 py-2 font-mono text-sm text-white focus:border-amber/50 focus:outline-none"
                />
                <button
                  onClick={() => removeTime(i)}
                  disabled={editTimes.length <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-raised text-muted transition-colors hover:border-red-500/30 hover:text-red-400 disabled:opacity-30"
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {editTimes.length < 5 && (
            <button
              onClick={addTime}
              className="mt-2 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-amber"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add run time
            </button>
          )}
        </div>

        <button
          onClick={saveSchedule}
          disabled={saving || !hasUnsavedChanges}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Schedule"}
          {hasUnsavedChanges && !saving && (
            <span className="rounded-full bg-bg/20 px-1.5 py-0.5 text-xs">unsaved</span>
          )}
        </button>
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

      {toast && <Toast message={toast.message} ok={toast.ok} />}
    </div>
  );
}
