import Link from "next/link";

export function Brand({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Pegwin Circle home">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-sm shadow-brand-600/30"
      >
        P
      </span>
      <span
        className={`font-display text-xl font-bold tracking-tight ${light ? "text-white" : "text-ink-900"}`}
      >
        Pegwin<span className={light ? "text-brand-300" : "text-brand-600"}> Circle</span>
      </span>
    </Link>
  );
}
