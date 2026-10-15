import type { Payout } from "./api-types";

/**
 * Admin analytics derivations. Every function is pure and works on data the
 * admin portal already fetches — no new backend contract is required.
 */

export interface StatusCount {
  status: string;
  count: number;
}

/** Count events per status, most-common first. */
export function countEventsByStatus(
  events: Array<{ status: string }>,
): StatusCount[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.status, (counts.get(event.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

/** Count a by-status record (e.g. `admin/overview` events) into rows. */
export function countRecordByStatus(byStatus: Record<string, number>): StatusCount[] {
  return Object.entries(byStatus)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

/** Top events by tickets sold, highest first. Never mutates the input. */
export function topEventsBySales<T extends { soldCount: number }>(
  events: T[],
  limit = 8,
): T[] {
  return [...events].sort((a, b) => b.soldCount - a.soldCount).slice(0, Math.max(0, limit));
}

/** Count payouts per status, most-common first. */
export function countPayoutsByStatus(payouts: Payout[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const payout of payouts) {
    counts.set(payout.status, (counts.get(payout.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}
