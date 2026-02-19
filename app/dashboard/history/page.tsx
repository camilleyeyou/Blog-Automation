"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">History</h1>
          <p className="mt-1 text-sm text-muted">All pipeline runs · last 50</p>
        </div>
        <button
          onClick={fetchLogs}
          className="rounded-lg border border-edge px-3 py-2 text-sm text-muted transition-colors hover:border-muted/50 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Confidence</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">SEO</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wide text-muted">Date</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted">Loading…</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <p className="text-sm text-muted">No history yet.</p>
                  <p className="mt-1 text-xs text-muted/60">Pipeline runs will appear here.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="cursor-pointer transition-colors hover:bg-raised/50"
                  >
                    <td className="px-5 py-3.5"><StatusBadge status={log.status} /></td>
                    <td className="px-5 py-3.5">
                      {log.confidence_score != null ? (
                        <ConfidenceBar score={log.confidence_score} size="sm" />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-muted">
                      {log.seo_checks_passed != null ? `${log.seo_checks_passed}/15` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted/40">
                      {expanded === log.id ? "▲" : "▾"}
                    </td>
                  </tr>

                  {expanded === log.id && (
                    <tr key={`${log.id}-detail`} className="bg-raised/30">
                      <td colSpan={5} className="px-5 py-4">
                        <div className="space-y-2.5 text-sm">
                          {log.revision_notes && (
                            <p className="text-muted">
                              <span className="font-medium text-white">Notes: </span>
                              {log.revision_notes}
                            </p>
                          )}
                          {log.error_message && (
                            <p className="text-red-400">
                              <span className="font-medium">Error: </span>
                              {log.error_message}
                            </p>
                          )}
                          {log.post_id && (
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted">
                                Post ID: <span className="font-mono text-white">{log.post_id}</span>
                              </p>
                              <Link
                                href={`/dashboard/post/${log.post_id}`}
                                className="rounded-lg bg-amber px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-amber/90"
                              >
                                View Post →
                              </Link>
                            </div>
                          )}
                          {!log.revision_notes && !log.error_message && !log.post_id && (
                            <p className="text-xs text-muted/50">No additional details.</p>
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
