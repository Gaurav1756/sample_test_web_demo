"use client";

import * as React from "react";
import Link from "next/link";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { newIdempotencyKey } from "@/lib/api-client";
import type { Order, Payment, PaymentIntent } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";

/**
 * Payment step. Calls the documented §8 endpoints and reports exactly what
 * the backend says. The §8 contract itself is a TBD draft (CQ-14): until the
 * backend finalizes it, expect honest errors here, never a fake success.
 */
export function PayForm({ order }: { order: Order }) {
  const [method, setMethod] = React.useState("upi");
  const [busy, setBusy] = React.useState(false);
  const [intent, setIntent] = React.useState<PaymentIntent | null>(null);
  const [payment, setPayment] = React.useState<Payment | null>(null);
  const [error, setError] = React.useState<{ message: string; recovery?: string } | null>(null);
  const payKey = React.useRef(newIdempotencyKey());

  const pay = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await bff<PaymentIntent>(
        "payments/intents",
        {
          method: "POST",
          body: { orderId: order.id, method },
          idempotencyKey: payKey.current,
        },
      );
      setIntent(res);
      const status = await bff<Payment>(`payments/${res.paymentId}`);
      setPayment(status);
    } catch (e) {
      if (e instanceof ApiError) {
        const g = e.guidance();
        setError({ message: e.message || g.message, recovery: g.recovery });
      } else {
        setError({ message: "Something went wrong.", recovery: "Please try again." });
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshStatus = async () => {
    if (!intent) return;
    setError(null);
    try {
      setPayment(await bff<Payment>(`payments/${intent.paymentId}`));
    } catch (e) {
      if (e instanceof ApiError) {
        const g = e.guidance();
        setError({ message: e.message || g.message, recovery: g.recovery });
      }
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <h2 className="font-display text-xl">Pay</h2>
        <div className="mt-4 max-w-sm">
          <Field label="Payment method" htmlFor="method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </Select>
          </Field>
        </div>
        {error ? (
          <div className="mt-4 max-w-md">
            <InlineError message={error.message} recovery={error.recovery} />
          </div>
        ) : null}
        <div className="mt-5 flex gap-3">
          <Button onClick={pay} disabled={busy}>
            {busy ? "Processing…" : `Pay ${formatPaise(order.amounts.finalPayable)}`}
          </Button>
          {intent ? (
            <Button variant="secondary" onClick={refreshStatus}>
              Refresh status
            </Button>
          ) : null}
        </div>
        {payment ? (
          <div className="mt-5 flex items-center gap-3">
            <StatusBadge status={payment.status} />
            {payment.status === "success" ? (
              <Link
                href={`/bookings`}
                className="text-sm font-semibold text-brand-800 hover:underline"
              >
                View your tickets →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <aside>
        <div className="rounded-xl border border-stone-200 p-5">
          <h2 className="font-display text-lg">Order</h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {order.items.map((item, i) => (
              <div key={`${item.tierId}-${i}`} className="flex items-center justify-between gap-2">
                <dt className="text-stone-600">
                  {item.qty} × {item.tierName}
                </dt>
                <dd className="font-medium">{formatPaise(item.unitPrice)} each</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-bold text-brand-900">{formatPaise(order.amounts.finalPayable)}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
