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
  pending:     "bg-stone/10 text-charcoal ring-stone/20",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  published:   "bg-emerald-50 text-emerald-700 ring-emerald-200",
  success:     "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft:       "bg-amber-50 text-amber-700 ring-amber-200",
  held:        "bg-orange-50 text-orange-700 ring-orange-200",
  discarded:   "bg-beige text-stone ring-beige",
  error:       "bg-red-50 text-red-600 ring-red-200",
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
        styles[status] ?? "bg-beige text-charcoal ring-beige"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
