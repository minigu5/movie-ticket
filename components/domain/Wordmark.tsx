interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "text-3xl",
  md: "text-5xl md:text-6xl",
  lg: "text-6xl md:text-7xl",
};

export function Wordmark({ size = "md", className }: Props) {
  return (
    <div className={`relative inline-flex flex-col items-center select-none ${className ?? ""}`}>
      {/* concentric amber halos behind wordmark */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,158,11,0.32) 0%, rgba(245,158,11,0.18) 30%, rgba(245,158,11,0.08) 55%, transparent 75%)",
          filter: "blur(28px)",
          transform: "scale(1.4)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(closest-side, rgba(251,191,36,0.18) 0%, transparent 60%)",
          filter: "blur(48px)",
          transform: "scale(2)",
        }}
      />
      <h1
        className={`font-display ${sizeMap[size]} text-[var(--color-text-primary)] tracking-[0.08em] leading-[1.05] text-center`}
        style={{ textShadow: "0 0 28px rgba(245,158,11,0.28), 0 0 12px rgba(255,255,255,0.08)" }}
      >
        영화
        <br />
        대교
      </h1>
    </div>
  );
}
