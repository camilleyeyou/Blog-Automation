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
  pending: "bg-beige text-charcoal",
  in_progress: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  success: "bg-green-100 text-green-800",
  draft: "bg-yellow-100 text-yellow-800",
  held: "bg-orange-100 text-orange-800",
  discarded: "bg-stone/30 text-charcoal/50",
  error: "bg-red-100 text-red-800",
};

const labels: Record<Status, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  published: "Published",
  success: "Published",
  draft: "Draft",
  held: "Held",
  discarded: "Discarded",
  error: "Error",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? "bg-beige text-charcoal"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
