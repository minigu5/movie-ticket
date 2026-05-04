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
    <div className={`relative inline-flex items-center justify-center select-none ${className ?? ""}`}>
      {/* outermost diffuse cream halo */}
      <div
        aria-hidden
        className="absolute pointer-events-none -z-10"
        style={{
          width: "320%",
          height: "320%",
          background:
            "radial-gradient(closest-side, rgba(254,243,199,0.18) 0%, rgba(252,211,77,0.12) 28%, rgba(245,158,11,0.06) 55%, transparent 78%)",
          filter: "blur(48px)",
        }}
      />
      {/* warm core glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none -z-10"
        style={{
          width: "190%",
          height: "190%",
          background:
            "radial-gradient(closest-side, rgba(254,235,170,0.28) 0%, rgba(245,200,100,0.14) 45%, transparent 75%)",
          filter: "blur(28px)",
        }}
      />
      {/* tightest highlight */}
      <div
        aria-hidden
        className="absolute pointer-events-none -z-10"
        style={{
          width: "120%",
          height: "120%",
          background:
            "radial-gradient(closest-side, rgba(255,245,200,0.22) 0%, transparent 70%)",
          filter: "blur(14px)",
        }}
      />
      <h1
        className={`relative font-display ${sizeMap[size]} text-[var(--color-text-primary)] tracking-[0.08em] leading-[1.05] text-center`}
        style={{
          textShadow:
            "0 0 22px rgba(254,235,170,0.35), 0 0 8px rgba(255,255,255,0.12)",
        }}
      >
        영화
        <br />
        대교
      </h1>
    </div>
  );
}
