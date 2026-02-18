"use client";

import { useState, useEffect, useCallback } from "react";
import type { QueueItem, AutomationLog } from "@/services/supabase";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

interface HeldItem {
  queue: QueueItem;
  log: AutomationLog | null;
}

export default function ReviewPage() {
  const [items, setItems] = useState<HeldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HeldItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch held queue items with their logs via the queue endpoint
      const res = await fetch("/api/queue", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { items: QueueItem[] };
      const held = data.items
        .filter((i) => i.status === "held")
        .map((q) => ({ queue: q, log: null }));
      setItems(held as HeldItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  async function handleAction(id: string, action: "approve" | "discard") {
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setActionResult(action === "approve" ? "Published successfully." : "Discarded.");
      setSelected(null);
      await fetchItems();
    } catch (err) {
      setActionResult(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-1 text-sm text-stone">
          Posts held for human review (confidence &lt; 70)
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionResult && (
        <div className="rounded-lg border border-beige bg-white px-4 py-3 text-sm">
          {actionResult}
        </div>
      )}

      <div className="grid gap-4">
        {loading ? (
          <p className="text-sm text-stone">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-stone">No posts held for review.</p>
        ) : (
          items.map(({ queue, log }) => (
            <div key={queue.id} className="rounded-xl border border-beige bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-ink">{queue.topic}</div>
                  <div className="mt-1 text-sm text-stone">
                    Keyphrase: {queue.focus_keyphrase ?? "—"}
                  </div>
                  {log && (
                    <div className="mt-1 text-xs text-stone">
                      Confidence: {log.confidence_score ?? "—"} &middot; SEO checks:{" "}
                      {log.seo_checks_passed != null ? `${log.seo_checks_passed}/13` : "—"}
                    </div>
                  )}
                  {log?.revision_notes && (
                    <div className="mt-2 text-xs text-charcoal/60">{log.revision_notes}</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleAction(queue.id, "discard")}
                    disabled={actionLoading}
                    className="rounded-lg border border-beige px-3 py-1.5 text-xs text-stone hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => setSelected({ queue, log })}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs text-cream hover:bg-charcoal"
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Review: {selected.queue.topic}</h2>
            <p className="mb-4 text-sm text-stone">
              To publish this post, use the approve button. The pipeline content will be
              submitted as-is. To make edits, discard and re-run the pipeline manually.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-beige px-4 py-2 text-sm text-stone hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selected.queue.id, "discard")}
                disabled={actionLoading}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Discard
              </button>
              <button
                onClick={() => handleAction(selected.queue.id, "approve")}
                disabled={actionLoading}
                className="rounded-lg bg-ink px-4 py-2 text-sm text-cream hover:bg-charcoal disabled:opacity-40"
              >
                {actionLoading ? "Publishing…" : "Approve & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
