"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { newIdempotencyKey } from "@/lib/api-client";
import type {
  CouponValidation,
  EventDetail,
  Hold,
  Order,
  Quote,
  Tier,
} from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { validateCouponCode, validateQuantity } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { PriceBreakdown } from "./price-breakdown";
import { HoldCountdown } from "./hold-countdown";

interface AttendeeEntry {
  name: string;
  phone: string;
  email: string;
}

type Step = "tickets" | "details" | "review";

function blankAttendees(count: number): AttendeeEntry[] {
  return Array.from({ length: count }, () => ({ name: "", phone: "", email: "" }));
}

/**
 * Checkout state machine: select tiers → 10-min hold → attendee details +
 * coupon + server quote → review → idempotent order. All totals come from
 * POST /checkout/quote; the client only sends tier ids, quantities and
 * attendee info.
 */
export function CheckoutFlow({ event, tiers }: { event: EventDetail; tiers: Tier[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("tickets");
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [hold, setHold] = React.useState<Hold | null>(null);
  const [attendees, setAttendees] = React.useState<AttendeeEntry[]>([]);
  const [coupon, setCoupon] = React.useState("");
  const [couponState, setCouponState] = React.useState<"idle" | "checking" | "applied">("idle");
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; recovery?: string } | null>(null);
  // One idempotency key per order attempt; reused across retries (API §1).
  const orderKey = React.useRef(newIdempotencyKey());

  const items = tiers
    .map((t) => ({ tierId: t.id, qty: qty[t.id] ?? 0 }))
    .filter((i) => i.qty > 0);
  const ticketCount = items.reduce((n, i) => n + i.qty, 0);

  const showError = (e: unknown) => {
    if (e instanceof ApiError) {
      const g = e.guidance();
      setError({ message: e.message || g.message, recovery: g.recovery });
      if (e.code === "HOLD_EXPIRED") {
        setHold(null);
        setQuote(null);
        setStep("tickets");
      }
      if (e.code === "UNAUTHENTICATED") router.push(`/sign-in?next=/events/${event.id}/checkout`);
    } else {
      setError({ message: "Something went wrong.", recovery: "Please try again." });
    }
  };

  const setTierQty = (tier: Tier, next: number) => {
    const clamped = Math.max(0, Math.min(next, 10, tier.availableCount));
    setQty((prev) => ({ ...prev, [tier.id]: clamped }));
  };

  const createHold = async () => {
    setError(null);
    for (const i of items) {
      const invalid = validateQuantity(i.qty);
      if (invalid) {
        setError({ message: invalid });
        return;
      }
    }
    if (items.length === 0) {
      setError({ message: "Select at least one ticket." });
      return;
    }
    setBusy(true);
    try {
      const res = await bff<Hold>("checkout/holds", { method: "POST", body: { items } });
      setHold(res);
      setAttendees(blankAttendees(ticketCount));
      setQuote(null);
      setCouponState("idle");
      setStep("details");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = async () => {
    const codeError = validateCouponCode(coupon);
    if (codeError) {
      setError({ message: codeError });
      return;
    }
    setError(null);
    setCouponState("checking");
    try {
      // Validate per selected tier (§6 takes tierId + qty).
      const results = await Promise.all(
        items.map((i) =>
          bff<CouponValidation>("checkout/coupons/validate", {
            method: "POST",
            body: { code: coupon.trim(), tierId: i.tierId, qty: i.qty },
          }),
        ),
      );
      const rejected = results.find((r) => !r.valid);
      if (rejected) {
        setError({
          message: "This coupon cannot be applied.",
          recovery: rejected.reason || "Check eligible tiers and validity dates.",
        });
        setCouponState("idle");
        return;
      }
      setCouponState("applied");
      await refreshQuote(coupon.trim());
    } catch (e) {
      setCouponState("idle");
      showError(e);
    }
  };

  const refreshQuote = async (code?: string) => {
    setError(null);
    try {
      const res = await bff<Quote>("checkout/quote", {
        method: "POST",
        body: { items, ...(code ? { couponCode: code } : {}) },
      });
      setQuote(res);
    } catch (e) {
      showError(e);
    }
  };

  const updateAttendee = (index: number, patch: Partial<AttendeeEntry>) => {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const continueToReview = async () => {
    for (const [i, a] of attendees.entries()) {
      if (!a.name.trim()) {
        setError({ message: `Enter the name for ticket ${i + 1}.` });
        return;
      }
    }
    await refreshQuote(couponState === "applied" ? coupon.trim() : undefined);
    setStep("review");
  };

  const placeOrder = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await bff<Order>(
        "orders",
        {
          method: "POST",
          body: {
            holdId: hold?.holdId,
            attendees: attendees.map((a) => ({
              name: a.name.trim(),
              ...(a.phone.trim() ? { phone: a.phone.trim() } : {}),
              ...(a.email.trim() ? { email: a.email.trim() } : {}),
            })),
            ...(couponState === "applied" ? { couponCode: coupon.trim() } : {}),
          },
          idempotencyKey: orderKey.current,
        },
      );
      router.push(`/events/${event.id}/pay?order=${res.id}`);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const expireHold = React.useCallback(() => {
    setHold(null);
    setQuote(null);
    setStep("tickets");
    setError({
      message: "Your ticket hold has expired.",
      recovery: "Select tickets again to start a fresh 10-minute hold.",
    });
  }, []);

  // Server truth for the active hold: GET status + TTL every 30s while the
  // user fills details or reviews. Unknown statuses keep the local hold.
  React.useEffect(() => {
    if (!hold || step === "tickets") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await bff<Hold>(`checkout/holds/${hold.holdId}`);
        if (cancelled) return;
        const s = (res.status ?? "").toLowerCase();
        if (["expired", "released", "cancelled"].includes(s)) {
          expireHold();
          return;
        }
        if (res.expiresAt && res.expiresAt !== hold.expiresAt) setHold(res);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.code === "HOLD_EXPIRED" || e.status === 404)) {
          expireHold();
        }
        // Other errors: keep the local countdown running.
      }
    };
    const t = window.setInterval(poll, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [hold, step, expireHold]);

  /** Explicit abandon: release the server hold, then reselect. */
  const changeTickets = async () => {
    setError(null);
    if (hold) {
      try {
        await bff(`checkout/holds/${hold.holdId}`, { method: "DELETE" });
      } catch {
        // Best-effort: the TTL expires it anyway.
      }
    }
    setHold(null);
    setQuote(null);
    setCouponState("idle");
    setStep("tickets");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0">
        {step === "tickets" ? (
          <section aria-label="Select tickets">
            <h2 className="font-display text-xl">1. Select tickets</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {tiers.map((tier) => (
                <li
                  key={tier.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4"
                >
                  <div>
                    <p className="font-semibold">{tier.name}</p>
                    <p className="text-sm text-stone-600">
                      {formatPaise(tier.price)} · {tier.availableCount} available
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={(qty[tier.id] ?? 0) === 0}
                      onClick={() => setTierQty(tier, (qty[tier.id] ?? 0) - 1)}
                      aria-label={`Remove one ${tier.name}`}
                    >
                      −
                    </Button>
                    <span aria-live="polite" className="w-6 text-center font-bold">
                      {qty[tier.id] ?? 0}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={(qty[tier.id] ?? 0) >= Math.min(10, tier.availableCount)}
                      onClick={() => setTierQty(tier, (qty[tier.id] ?? 0) + 1)}
                      aria-label={`Add one ${tier.name}`}
                    >
                      +
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button onClick={createHold} disabled={busy || ticketCount === 0} className="mt-5">
              {busy ? "Holding tickets…" : `Continue with ${ticketCount} ticket${ticketCount === 1 ? "" : "s"}`}
            </Button>
          </section>
        ) : null}

        {step !== "tickets" && hold ? (
          <div className="mb-5">
            <HoldCountdown expiresAt={hold.expiresAt} onExpire={expireHold} />
          </div>
        ) : null}

        {step === "details" ? (
          <section aria-label="Attendee details">
            <h2 className="font-display text-xl">2. Who&apos;s attending?</h2>
            <div className="mt-4 flex flex-col gap-4">
              {attendees.map((a, i) => (
                <fieldset key={i} className="rounded-xl border border-stone-200 p-4">
                  <legend className="px-1 text-sm font-semibold">Ticket {i + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Name" htmlFor={`name-${i}`} required>
                      <Input
                        value={a.name}
                        maxLength={100}
                        onChange={(e) => updateAttendee(i, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Phone" htmlFor={`phone-${i}`}>
                      <Input
                        value={a.phone}
                        onChange={(e) => updateAttendee(i, { phone: e.target.value })}
                        placeholder="Optional"
                      />
                    </Field>
                    <Field label="Email" htmlFor={`email-${i}`}>
                      <Input
                        value={a.email}
                        onChange={(e) => updateAttendee(i, { email: e.target.value })}
                        placeholder="Optional"
                      />
                    </Field>
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="Coupon code" htmlFor="coupon">
                  <Input
                    value={coupon}
                    maxLength={50}
                    disabled={couponState === "applied"}
                    onChange={(e) => {
                      setCoupon(e.target.value);
                      setCouponState("idle");
                    }}
                    placeholder="Optional"
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={couponState !== "idle" || !coupon.trim()}
                onClick={applyCoupon}
              >
                {couponState === "checking" ? "Checking…" : couponState === "applied" ? "Applied ✓" : "Apply"}
              </Button>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" onClick={changeTickets}>
                Change tickets
              </Button>
              <Button onClick={continueToReview} disabled={busy}>
                Review order
              </Button>
            </div>
          </section>
        ) : null}

        {step === "review" ? (
          <section aria-label="Review order">
            <h2 className="font-display text-xl">3. Review and place order</h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {attendees.map((a, i) => (
                <li key={i} className="rounded-lg border border-stone-200 px-4 py-2">
                  <span className="font-semibold">Ticket {i + 1}:</span> {a.name}
                  {a.phone ? ` · ${a.phone}` : ""}
                  {a.email ? ` · ${a.email}` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setStep("details")}>
                Back
              </Button>
              <Button variant="secondary" onClick={changeTickets}>
                Change tickets
              </Button>
              <Button onClick={placeOrder} disabled={busy}>
                {busy ? "Placing order…" : "Place order"}
              </Button>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="mt-5">
            <InlineError message={error.message} recovery={error.recovery} />
          </div>
        ) : null}
      </div>

      <aside className="min-w-0">
        <div className="rounded-xl border border-stone-200 p-5 lg:sticky lg:top-4">
          <h2 className="font-display text-lg">Order summary</h2>
          <p className="mt-1 text-sm text-stone-600">{event.title}</p>
          <div className="mt-4">
            {quote ? (
              <PriceBreakdown quote={quote} />
            ) : (
              <p className="text-sm text-stone-500">
                {ticketCount > 0
                  ? `${ticketCount} ticket${ticketCount === 1 ? "" : "s"} selected. Totals appear here from the server quote.`
                  : "Select tickets to see pricing."}
              </p>
            )}
          </div>
          {step !== "tickets" && !quote ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => refreshQuote(couponState === "applied" ? coupon.trim() : undefined)}
            >
              Refresh totals
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
