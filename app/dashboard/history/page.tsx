"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import type { AutomationLog } from "@/services/supabase";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw, "Content-Type": "application/json" };
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/logs?limit=50", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { logs: AutomationLog[] };
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-stone">All pipeline runs · last 50</p>
        </div>
        <button
          onClick={fetchLogs}
          className="rounded-lg border border-beige px-3 py-2 text-sm text-stone transition-colors hover:border-stone hover:text-ink"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-beige bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-beige/30">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-stone">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-stone">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-stone">
                SEO
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-stone">
                Date
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-beige/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-sm text-stone">No history yet.</p>
                  <p className="mt-1 text-xs text-stone/60">Pipeline runs will appear here.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="cursor-pointer hover:bg-cream/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3">
                      {log.confidence_score != null ? (
                        <ConfidenceBar score={log.confidence_score} size="sm" />
                      ) : (
                        <span className="text-stone">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-charcoal">
                      {log.seo_checks_passed != null
                        ? `${log.seo_checks_passed}/13`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-stone">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-stone/40">
                      {expanded === log.id ? "▲" : "▾"}
                    </td>
                  </tr>

                  {expanded === log.id && (
                    <tr key={`${log.id}-detail`} className="bg-cream/40">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2 text-sm">
                          {log.revision_notes && (
                            <p className="text-charcoal/70">
                              <span className="font-medium text-charcoal">Notes: </span>
                              {log.revision_notes}
                            </p>
                          )}
                          {log.error_message && (
                            <p className="text-red-500">
                              <span className="font-medium">Error: </span>
                              {log.error_message}
                            </p>
                          )}
                          {log.post_id && (
                            <p className="text-xs text-stone">
                              Post ID:{" "}
                              <span className="font-mono">{log.post_id}</span>
                            </p>
                          )}
                          {!log.revision_notes && !log.error_message && !log.post_id && (
                            <p className="text-xs text-stone/50">No additional details.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
