/**
 * Presentation formatting. Money is always integer paise from the backend
 * (§1a); this module only formats for display and never computes payables.
 */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

/** Format integer paise as INR (53100 → "₹531.00"). */
export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

/** Format an ISO timestamp as a readable date, e.g. "18 Aug 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format an ISO timestamp as date + time, e.g. "18 Aug 2026, 6:30 pm". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    ", " +
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  );
}

/** Seconds remaining until an ISO timestamp (used for hold countdowns). */
export function secondsUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

/** Format seconds as m:ss for countdown display. */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
