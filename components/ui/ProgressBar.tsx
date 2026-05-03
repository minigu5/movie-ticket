export function ProgressBar({
  current,
  total,
  tone = "amber",
}: {
  current: number;
  total: number;
  tone?: "amber" | "emerald" | "sky";
}) {
  const pct = total === 0 ? 0 : Math.min(100, (current / total) * 100);
  const fill =
    tone === "emerald"
      ? "bg-[var(--color-success)]"
      : tone === "sky"
        ? "bg-[var(--color-info)]"
        : "bg-[var(--color-accent)]";
  return (
    <div className="w-full">
      <div className="w-full h-2 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
        <div className={`h-full ${fill} transition-[width] duration-500 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--color-text-muted)] font-mono">
        <span>{Math.round(pct)}%</span>
        <span>
          {current} / {total}
        </span>
      </div>
    </div>
  );
}
