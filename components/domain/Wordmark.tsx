interface Props {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  className?: string;
}

const sizeMap = {
  sm: "text-3xl",
  md: "text-5xl md:text-6xl",
  lg: "text-6xl md:text-7xl",
};

export function Wordmark({ size = "md", subtitle, className }: Props) {
  return (
    <div className={`relative inline-flex flex-col items-center select-none ${className ?? ""}`}>
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,158,11,0.4), transparent 70%)",
        }}
        aria-hidden
      />
      <h1
        className={`font-display ${sizeMap[size]} text-[var(--color-text-primary)] tracking-[0.08em] leading-[1.05] text-center`}
        style={{ textShadow: "0 0 24px rgba(255,255,255,0.12)" }}
      >
        영화
        <br />
        대교
      </h1>
      {subtitle && (
        <span className="mt-3 text-[10px] md:text-[11px] tracking-[0.4em] uppercase text-[var(--color-accent-soft)] font-medium">
          {subtitle}
        </span>
      )}
    </div>
  );
}
