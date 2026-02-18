"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-stone">All pipeline runs (last 50)</p>
        </div>
        <button
          onClick={fetchLogs}
          className="rounded-lg border border-beige px-3 py-1.5 text-sm text-stone hover:text-ink"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-beige">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-beige/40">
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Confidence</th>
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">SEO</th>
              <th className="px-4 py-2.5 text-left font-medium text-charcoal">Date</th>
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
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone">
                  No history yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="border-b border-beige/60 bg-white last:border-0"
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-charcoal">{log.confidence_score ?? "—"}</td>
                    <td className="px-4 py-3 text-charcoal">
                      {log.seo_checks_passed != null ? `${log.seo_checks_passed}/13` : "—"}
                    </td>
                    <td className="px-4 py-3 text-stone">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          setExpanded(expanded === log.id ? null : log.id)
                        }
                        className="text-xs text-stone hover:text-ink"
                      >
                        {expanded === log.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-detail`} className="bg-beige/20">
                      <td colSpan={5} className="px-4 py-4">
                        {log.revision_notes && (
                          <p className="text-sm text-charcoal/70">
                            <span className="font-medium">Notes:</span>{" "}
                            {log.revision_notes}
                          </p>
                        )}
                        {log.error_message && (
                          <p className="mt-1 text-sm text-red-600">
                            <span className="font-medium">Error:</span>{" "}
                            {log.error_message}
                          </p>
                        )}
                        {log.post_id && (
                          <p className="mt-1 text-xs text-stone">
                            Post ID: {log.post_id}
                          </p>
                        )}
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
