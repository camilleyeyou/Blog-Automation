interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceBar({ score, showLabel = true, size = "md" }: ConfidenceBarProps) {
  const color =
    score >= 85 ? "bg-emerald-400" : score >= 70 ? "bg-amber" : "bg-red-400";
  const barWidth = size === "sm" ? "w-16" : "w-24";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-1.5 ${barWidth} overflow-hidden rounded-full bg-raised`}>
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm tabular-nums text-white">{score}</span>
      )}
    </div>
  );
}
