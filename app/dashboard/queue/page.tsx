"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { QueueItem } from "@/services/supabase";

const DASHBOARD_PASSWORD =
  typeof window !== "undefined"
    ? (localStorage.getItem("dashboard_password") ?? "")
    : "";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [keyphrase, setKeyphrase] = useState("");
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

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

  async function handleAdd(e: React.FormEvent) {
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
    setRunResult(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      setRunResult(data.error ? `Error: ${data.error}` : `Done — ${data.status}`);
      await fetchItems();
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Failed to run pipeline");
    } finally {
      setRunning(false);
    }
  }

  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Topic Queue</h1>
          <p className="mt-1 text-sm text-stone">
            {pending.length} topic{pending.length !== 1 ? "s" : ""} pending
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={running || pending.length === 0}
          className="rounded-lg bg-ink px-4 py-2 text-sm text-cream hover:bg-charcoal disabled:opacity-40"
        >
          {running ? "Running…" : "Run Now"}
        </button>
      </div>

      {runResult && (
        <div className="rounded-lg border border-beige bg-white px-4 py-3 text-sm">
          {runResult}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add topic form */}
      <div className="rounded-xl border border-beige bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-stone uppercase tracking-wide">
          Add topic
        </h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic"
            className="flex-1 rounded-lg border border-beige bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone"
          />
          <input
            value={keyphrase}
            onChange={(e) => setKeyphrase(e.target.value)}
            placeholder="Focus keyphrase (optional)"
            className="flex-1 rounded-lg border border-beige bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone"
          />
          <button
            type="submit"
            disabled={adding || !topic.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-sm text-cream hover:bg-charcoal disabled:opacity-40"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      {/* Queue table */}
      <div className="overflow-hidden rounded-xl border border-beige">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-beige/40">
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Topic</th>
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Keyphrase</th>
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Added</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone">
                  Queue is empty.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-beige/60 bg-white last:border-0">
                  <td className="px-4 py-3 text-charcoal">{item.topic}</td>
                  <td className="px-4 py-3 text-stone">{item.focus_keyphrase ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-stone">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleDiscard(item.id)}
                        className="text-xs text-stone hover:text-red-600"
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
    </div>
  );
}
