"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfidenceBar } from "@/components/ConfidenceBar";
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
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
      setActionResult({
        ok: true,
        message: action === "approve" ? "Post published successfully." : "Post discarded.",
      });
      setSelected(null);
      await fetchItems();
    } catch (err) {
      setActionResult({
        ok: false,
        message: err instanceof Error ? err.message : "Action failed",
      });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-1 text-sm text-stone">
          Posts held for human review · confidence &lt; 70
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {actionResult && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            actionResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {actionResult.message}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-beige bg-white px-6 py-10 text-center shadow-card">
            <p className="text-sm text-stone">Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-beige bg-white px-6 py-10 text-center shadow-card">
            <p className="text-sm text-stone">No posts held for review.</p>
            <p className="mt-1 text-xs text-stone/60">
              Posts with a confidence score below 70 will appear here.
            </p>
          </div>
        ) : (
          items.map(({ queue, log }) => (
            <div
              key={queue.id}
              className="rounded-xl border border-beige bg-white p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{queue.topic}</div>
                  {queue.focus_keyphrase && (
                    <div className="mt-0.5 text-sm text-stone">
                      {queue.focus_keyphrase}
                    </div>
                  )}
                  {log && (
                    <div className="mt-3 flex items-center gap-5">
                      {log.confidence_score != null && (
                        <div>
                          <div className="text-xs text-stone mb-1.5">Confidence</div>
                          <ConfidenceBar score={log.confidence_score} size="sm" />
                        </div>
                      )}
                      {log.seo_checks_passed != null && (
                        <div>
                          <div className="text-xs text-stone mb-1.5">SEO</div>
                          <span className="text-sm tabular-nums text-charcoal">
                            {log.seo_checks_passed}/13
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {log?.revision_notes && (
                    <p className="mt-3 text-xs text-charcoal/50 line-clamp-2">
                      {log.revision_notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleAction(queue.id, "discard")}
                    disabled={actionLoading}
                    className="rounded-lg border border-beige px-3 py-1.5 text-xs text-stone transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => setSelected({ queue, log })}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-charcoal"
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card-md">
            <h2 className="mb-1 text-base font-semibold text-ink">
              {selected.queue.topic}
            </h2>
            {selected.queue.focus_keyphrase && (
              <p className="mb-4 text-sm text-stone">{selected.queue.focus_keyphrase}</p>
            )}
            <p className="mb-6 text-sm text-charcoal/60 leading-relaxed">
              Approving will publish this post as-is. To make edits, discard and
              re-run the pipeline manually.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-beige px-4 py-2 text-sm text-stone transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selected.queue.id, "discard")}
                disabled={actionLoading}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
              >
                Discard
              </button>
              <button
                onClick={() => handleAction(selected.queue.id, "approve")}
                disabled={actionLoading}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-charcoal disabled:opacity-40"
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
