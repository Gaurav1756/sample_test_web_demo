import Link from "next/link";

export function Pagination({
  page,
  total,
  limit,
  makeHref,
}: {
  page: number;
  total: number;
  limit: number;
  makeHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;
  const cls =
    "rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold hover:bg-stone-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      {prev ? (
        <Link href={makeHref(prev)} className={cls}>
          ← Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={cls}>
          ← Previous
        </span>
      )}
      <p className="text-sm text-stone-600">
        Page {page} of {totalPages} · {total} total
      </p>
      {next ? (
        <Link href={makeHref(next)} className={cls}>
          Next →
        </Link>
      ) : (
        <span aria-disabled="true" className={cls}>
          Next →
        </span>
      )}
    </nav>
  );
}
