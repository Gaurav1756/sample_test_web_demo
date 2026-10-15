import * as React from "react";

/** Status pill for documented lifecycle states (events, tickets, orders, payments, payouts, reports). */
const TONES: Record<string, string> = {
  // Positive / active
  live: "bg-emerald-100 text-emerald-900",
  on_sale: "bg-emerald-100 text-emerald-900",
  published: "bg-sky-100 text-sky-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  checked_in: "bg-emerald-100 text-emerald-900",
  completed: "bg-emerald-100 text-emerald-900",
  success: "bg-emerald-100 text-emerald-900",
  paid: "bg-emerald-100 text-emerald-900",
  verified: "bg-emerald-100 text-emerald-900",
  member: "bg-emerald-100 text-emerald-900",
  processed: "bg-emerald-100 text-emerald-900",
  // Pending / attention
  draft: "bg-stone-200 text-stone-800",
  review: "bg-amber-100 text-amber-900",
  pending: "bg-amber-100 text-amber-900",
  rescheduled: "bg-amber-100 text-amber-900",
  processing: "bg-amber-100 text-amber-900",
  open: "bg-amber-100 text-amber-900",
  held: "bg-amber-100 text-amber-900",
  // Negative / terminal
  cancelled: "bg-red-100 text-red-900",
  rejected: "bg-red-100 text-red-900",
  failed: "bg-red-100 text-red-900",
  refunded: "bg-red-100 text-red-900",
  partially_refunded: "bg-red-100 text-red-900",
  expired: "bg-stone-200 text-stone-800",
  removed: "bg-stone-200 text-stone-800",
  dismissed: "bg-stone-200 text-stone-800",
  blocked: "bg-stone-200 text-stone-800",
  actioned: "bg-sky-100 text-sky-900",
};

export function Badge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  const cls = (tone && TONES[tone]) || "bg-stone-200 text-stone-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

/** Humanize a documented status value: "on_sale" → "On sale". */
export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={status}>{statusLabel(status)}</Badge>;
}
