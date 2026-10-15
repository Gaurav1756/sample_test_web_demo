"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";

/**
 * Past-event rating input (POST /events/:id/ratings, attended-only).
 * Shown for completed events; the backend rejects ineligible raters.
 */
export function RateEvent({
  eventId,
  avgRating,
}: {
  eventId: string;
  avgRating?: number | null;
}) {
  const router = useRouter();
  const [score, setScore] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ avg?: number; count?: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (score < 1 || score > 5 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await bff<{ avg?: number; avgRating?: number; ratingCount?: number }>(
        `events/${eventId}/ratings`,
        { method: "POST", body: { score } },
      );
      setDone({ avg: res.avg ?? res.avgRating, count: res.ratingCount });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push(`/sign-in?next=${encodeURIComponent(`/events/${eventId}`)}`);
        return;
      }
      setError(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="font-display text-lg text-brand-900">Thanks for rating!</h2>
        <p className="mt-1 text-sm text-brand-950">
          You rated this event {score} out of 5
          {done.avg != null ? ` · average now ★ ${done.avg.toFixed(1)}` : ""}
          {done.count != null ? ` (${done.count} ratings)` : ""}.
        </p>
      </div>
    );
  }

  const shown = hover || score;
  return (
    <div className="rounded-xl border border-stone-200 p-5">
      <h2 className="font-display text-lg">Rate this event</h2>
      {avgRating != null ? (
        <p className="mt-1 text-sm text-stone-600">Currently ★ {avgRating.toFixed(1)}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setScore(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            className={`rounded p-1 text-2xl leading-none transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
              n <= shown ? "text-amber-500" : "text-stone-300"
            }`}
          >
            <span aria-hidden="true">★</span>
          </button>
        ))}
      </div>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <Button size="sm" className="mt-3" disabled={score === 0 || busy} onClick={submit}>
        {busy ? "Submitting…" : "Submit rating"}
      </Button>
    </div>
  );
}
