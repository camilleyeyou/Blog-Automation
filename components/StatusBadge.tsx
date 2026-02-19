type Status =
  | "pending"
  | "in_progress"
  | "published"
  | "held"
  | "discarded"
  | "success"
  | "draft"
  | "error";

const styles: Record<Status, string> = {
  pending:     "bg-muted/10 text-muted ring-muted/20",
  in_progress: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
  published:   "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  success:     "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  draft:       "bg-amber/10 text-amber ring-amber/20",
  held:        "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  discarded:   "bg-raised text-muted ring-edge",
  error:       "bg-red-500/10 text-red-400 ring-red-500/20",
};

const labels: Record<Status, string> = {
  pending:     "Pending",
  in_progress: "Running",
  published:   "Published",
  success:     "Published",
  draft:       "Draft",
  held:        "Held",
  discarded:   "Discarded",
  error:       "Error",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${
        styles[status] ?? "bg-raised text-muted ring-edge"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
