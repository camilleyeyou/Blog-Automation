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

export default function ReviewPage() {
  const [items, setItems] = useState<HeldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HeldItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
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
    try {
      const res = await fetch(`/api/review/${id}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (data.error) throw new Error(data.error);
      showToast(action === "approve" ? "Post published." : "Post discarded.", true);
      setSelected(null);
      await fetchItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", false);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Review Queue</h1>
        <p className="mt-1 text-sm text-muted">
          Posts held for human review · confidence &lt; 70
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-edge bg-surface px-6 py-12 text-center">
            <p className="text-sm text-muted">Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-edge bg-surface px-6 py-12 text-center">
            <p className="text-sm text-muted">No posts held for review.</p>
            <p className="mt-1 text-xs text-muted/60">
              Posts with a confidence score below 70 will appear here.
            </p>
          </div>
        ) : (
          items.map(({ queue, log }) => (
            <div key={queue.id} className="rounded-xl border border-edge bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white truncate">{queue.topic}</div>
                  {queue.focus_keyphrase && (
                    <div className="mt-0.5 text-sm text-muted">{queue.focus_keyphrase}</div>
                  )}
                  {log && (
                    <div className="mt-3 flex items-center gap-6">
                      {log.confidence_score != null && (
                        <div>
                          <div className="mb-1.5 text-xs text-muted">Confidence</div>
                          <ConfidenceBar score={log.confidence_score} size="sm" />
                        </div>
                      )}
                      {log.seo_checks_passed != null && (
                        <div>
                          <div className="mb-1.5 text-xs text-muted">SEO</div>
                          <span className="text-sm tabular-nums text-white">
                            {log.seo_checks_passed}/15
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {log?.revision_notes && (
                    <p className="mt-3 line-clamp-2 text-xs text-muted">{log.revision_notes}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleAction(queue.id, "discard")}
                    disabled={actionLoading}
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => setSelected({ queue, log })}
                    className="rounded-lg bg-amber px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-amber/90"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-card-md">
            <h2 className="mb-1 text-base font-semibold text-white">{selected.queue.topic}</h2>
            {selected.queue.focus_keyphrase && (
              <p className="mb-4 text-sm text-muted">{selected.queue.focus_keyphrase}</p>
            )}
            <p className="mb-6 text-sm text-muted leading-relaxed">
              Approving will publish this post as-is. To edit, discard and re-run the pipeline.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selected.queue.id, "discard")}
                disabled={actionLoading}
                className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
              >
                Discard
              </button>
              <button
                onClick={() => handleAction(selected.queue.id, "approve")}
                disabled={actionLoading}
                className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-amber/90 disabled:opacity-40"
              >
                {actionLoading ? "Publishing…" : "Approve & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} ok={toast.ok} />}
    </div>
  );
}
