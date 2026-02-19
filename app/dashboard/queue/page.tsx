"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { QueueItem } from "@/services/supabase";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
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

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [keyphrase, setKeyphrase] = useState("");
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/queue", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as { items: QueueItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  async function handleAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!topic.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ topic: topic.trim(), focus_keyphrase: keyphrase.trim() }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTopic("");
      setKeyphrase("");
      await fetchItems();
      showToast("Topic added", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add topic");
    } finally {
      setAdding(false);
    }
  }

  async function handleDiscard(id: string) {
    await fetch(`/api/queue/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: "discarded" }),
    });
    await fetchItems();
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (data.error) throw new Error(data.error);
      showToast(`Pipeline complete — ${data.status ?? "done"}`, true);
      await fetchItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Pipeline failed", false);
    } finally {
      setRunning(false);
    }
  }

  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Topic Queue</h1>
          <p className="mt-1 text-sm text-muted">
            {pending.length} topic{pending.length !== 1 ? "s" : ""} pending
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={running || pending.length === 0}
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-40"
        >
          {running ? "Running…" : "Run Pipeline"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Add topic */}
      <div className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">
          Add Topic
        </h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic"
            className="flex-1 rounded-lg border border-edge bg-raised px-3 py-2.5 text-sm text-white placeholder-muted/40 transition-colors focus:border-amber/50 focus:outline-none focus:ring-2 focus:ring-amber/10"
          />
          <input
            value={keyphrase}
            onChange={(e) => setKeyphrase(e.target.value)}
            placeholder="Focus keyphrase (optional)"
            className="flex-1 rounded-lg border border-edge bg-raised px-3 py-2.5 text-sm text-white placeholder-muted/40 transition-colors focus:border-amber/50 focus:outline-none focus:ring-2 focus:ring-amber/10"
          />
          <button
            type="submit"
            disabled={adding || !topic.trim()}
            className="rounded-lg bg-amber px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-40"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      {/* Queue table */}
      <div className="overflow-hidden rounded-xl border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Topic</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Keyphrase</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Added</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <p className="text-sm text-muted">Queue is empty.</p>
                  <p className="mt-1 text-xs text-muted/60">Add a topic above or hit Replenish Queue on the overview.</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-raised/50">
                  <td className="px-5 py-3.5 font-medium text-white">{item.topic}</td>
                  <td className="px-5 py-3.5 text-muted">{item.focus_keyphrase ?? "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-3.5 text-muted">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleDiscard(item.id)}
                        className="text-xs text-muted/60 transition-colors hover:text-red-400"
                      >
                        Discard
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} ok={toast.ok} />}
    </div>
  );
}
