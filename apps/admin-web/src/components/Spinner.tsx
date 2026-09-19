export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingLine({ label }: { label: string }) {
  return (
    <p className="loading-line">
      <Spinner />
      {label}
    </p>
  );
}
