/** Level indicator that never relies on color alone: dots (shape/count) + text label. */
export function LevelBadge({
  rank,
  label,
  ariaLabel,
  size = "sm",
}: {
  rank: number;
  label: string;
  ariaLabel?: string;
  size?: "sm" | "md";
}) {
  const dot = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" aria-label={ariaLabel ?? label}>
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`${dot} rounded-full ${i <= rank ? "bg-brand" : "border border-line-strong bg-transparent"}`}
          />
        ))}
      </span>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

export function Pill({ children, tone = "lilac" }: { children: React.ReactNode; tone?: "lilac" | "pink" | "neutral" | "success" | "warning" }) {
  const tones = {
    lilac: "bg-lilac-soft text-ink",
    pink: "bg-surface-2 text-ink",
    neutral: "bg-surface border border-line text-muted",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  } as const;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
