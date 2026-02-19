import { getLogs } from "@/services/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceBar } from "@/components/ConfidenceBar";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-beige bg-white px-5 py-5 shadow-card">
      <div className={`text-3xl font-semibold tabular-nums ${accent}`}>{value}</div>
      <div className="mt-1 text-xs text-stone">{label}</div>
    </div>
  );
}

export default async function OverviewPage() {
  let logs: Awaited<ReturnType<typeof getLogs>> = [];
  let error: string | null = null;

  try {
    logs = await getLogs(10);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load logs";
  }

  const latest = logs[0];
  const counts = {
    success: logs.filter((l) => l.status === "success").length,
    draft: logs.filter((l) => l.status === "draft").length,
    held: logs.filter((l) => l.status === "held").length,
    error: logs.filter((l) => l.status === "error").length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-stone">Pipeline performance · last 10 runs</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published" value={counts.success} accent="text-emerald-600" />
        <StatCard label="Drafts" value={counts.draft} accent="text-amber-600" />
        <StatCard label="Held" value={counts.held} accent="text-orange-500" />
        <StatCard label="Errors" value={counts.error} accent="text-red-500" />
      </div>

      {/* Latest run */}
      {latest ? (
        <div className="rounded-xl border border-beige bg-white p-6 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-medium uppercase tracking-widest text-stone">
              Latest Run
            </span>
            <StatusBadge status={latest.status} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-stone mb-2">Confidence Score</div>
              {latest.confidence_score != null ? (
                <ConfidenceBar score={latest.confidence_score} />
              ) : (
                <span className="text-sm text-stone">—</span>
              )}
            </div>
            <div>
              <div className="text-xs text-stone mb-2">SEO Checks Passed</div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-beige">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{
                      width: `${((latest.seo_checks_passed ?? 0) / 13) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm tabular-nums text-charcoal">
                  {latest.seo_checks_passed != null
                    ? `${latest.seo_checks_passed}/13`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {(latest.revision_notes || latest.error_message) && (
            <div className="mt-5 border-t border-beige pt-4 space-y-1.5">
              {latest.revision_notes && (
                <p className="text-sm text-charcoal/60">{latest.revision_notes}</p>
              )}
              {latest.error_message && (
                <p className="text-sm text-red-500">{latest.error_message}</p>
              )}
            </div>
          )}

          <div className="mt-4 text-xs text-stone">
            {new Date(latest.created_at).toLocaleString()}
          </div>
        </div>
      ) : (
        !error && (
          <div className="rounded-xl border border-beige bg-white px-6 py-10 text-center shadow-card">
            <p className="text-sm text-stone">No pipeline runs yet.</p>
            <p className="mt-1 text-xs text-stone/60">
              Trigger a run from the Queue page.
            </p>
          </div>
        )
      )}

      {/* Recent runs table */}
      {logs.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone">
            Recent Runs
          </h2>
          <div className="overflow-hidden rounded-xl border border-beige bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-beige/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase tracking-wide">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase tracking-wide">
                    SEO
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-cream/60 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3">
                      {log.confidence_score != null ? (
                        <ConfidenceBar
                          score={log.confidence_score}
                          size="sm"
                        />
                      ) : (
                        <span className="text-stone">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-charcoal tabular-nums">
                      {log.seo_checks_passed != null
                        ? `${log.seo_checks_passed}/13`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-stone">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
