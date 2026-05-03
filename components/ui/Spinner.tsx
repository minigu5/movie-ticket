export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="loading"
      className={[
        "inline-block rounded-full border-2 border-current border-r-transparent animate-spin",
        className ?? "",
      ].join(" ")}
      style={{ width: size, height: size }}
    />
  );
}
