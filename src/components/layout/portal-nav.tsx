"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  /** Prefix match instead of exact match. */
  prefix?: boolean;
}

/**
 * Shared portal navigation. Horizontal scroll bar on mobile, sticky
 * sidebar card on desktop. Each portal layout passes only routes that
 * exist — items are added as implementation phases land, so there are
 * never dead links.
 */
export function PortalNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.prefix ? pathname === item.href || pathname.startsWith(item.href + "/") : pathname === item.href;

  return (
    <nav
      aria-label={label}
      className="flex gap-1 overflow-x-auto py-2 lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible lg:rounded-3xl lg:border lg:border-stone-200/80 lg:bg-white lg:p-3 lg:py-3 lg:shadow-sm"
    >
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors lg:rounded-2xl ${
              active
                ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                : "text-stone-600 hover:bg-brand-50 hover:text-brand-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
