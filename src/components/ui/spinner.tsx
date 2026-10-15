export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-stone-600">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-700"
      />
      <span className="text-sm font-medium">{label}</span>
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-stone-200 ${className}`} />;
}
