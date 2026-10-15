import Link from "next/link";

export interface TabItem {
  label: string;
  href: string;
  active?: boolean;
}

/** Link-based tabs; works in server components via URL state. */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${
            item.active
              ? "border-brand-700 text-brand-800"
              : "border-transparent text-stone-500 hover:text-stone-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
