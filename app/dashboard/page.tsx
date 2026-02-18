import { getLogs } from "@/services/supabase";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let logs: Awaited<ReturnType<typeof getLogs>> = [];
  let error: string | null = null;

  try {
    logs = await getLogs(10);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load logs";
  }

  const latest = logs[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-stone">Blog automation pipeline status</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            ["success", "Published"],
            ["draft", "Drafts"],
            ["held", "Held"],
            ["error", "Errors"],
          ] as const
        ).map(([status, label]) => {
          const count = logs.filter((l) => l.status === status).length;
          return (
            <div key={status} className="rounded-xl border border-beige bg-white px-4 py-5">
              <div className="text-2xl font-semibold">{count}</div>
              <div className="mt-1 text-xs text-stone">{label} (last 10)</div>
            </div>
          );
        })}
      </div>

      {/* Latest run */}
      {latest && (
        <div className="rounded-xl border border-beige bg-white p-5">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-stone">
            Latest run
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={latest.status} />
            <span className="text-sm">
              Confidence: <strong>{latest.confidence_score ?? "—"}</strong>
            </span>
            <span className="text-sm">
              SEO checks:{" "}
              <strong>
                {latest.seo_checks_passed != null ? `${latest.seo_checks_passed}/13` : "—"}
              </strong>
            </span>
            <span className="ml-auto text-xs text-stone">
              {new Date(latest.created_at).toLocaleString()}
            </span>
          </div>
          {latest.revision_notes && (
            <p className="mt-3 text-sm text-charcoal/70">{latest.revision_notes}</p>
          )}
          {latest.error_message && (
            <p className="mt-3 text-sm text-red-600">{latest.error_message}</p>
          )}
        </div>
      )}

      {/* Recent runs table */}
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-stone">
          Recent runs
        </h2>
        <div className="overflow-hidden rounded-xl border border-beige">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-beige/40">
                <th className="px-4 py-2.5 text-left font-medium text-charcoal">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-charcoal">Confidence</th>
                <th className="px-4 py-2.5 text-left font-medium text-charcoal">SEO Checks</th>
                <th className="px-4 py-2.5 text-left font-medium text-charcoal">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-stone">
                    No runs yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-beige/60 bg-white last:border-0">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
