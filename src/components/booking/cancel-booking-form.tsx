"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { OrderCancellation, Receipt } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";

/** Booking cancellation with refund result + receipt (FIG p170-p174). */
export function CancelBookingForm({ orderId }: { orderId: string }) {
  const [reason, setReason] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<OrderCancellation | null>(null);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [error, setError] = React.useState<{ message: string; recovery?: string } | null>(null);

  const cancel = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await bff<OrderCancellation>(`orders/${orderId}/cancel`, {
        method: "POST",
        body: reason.trim() ? { reason: reason.trim().slice(0, 500) } : {},
      });
      setResult(res);
      setConfirming(false);
      const receiptRes = await bff<Receipt>(`orders/${orderId}/receipt`).catch(() => null);
      setReceipt(receiptRes);
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

  if (result) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
        <h2 className="font-display text-xl text-brand-900">Booking cancelled</h2>
        <dl className="mt-3 flex flex-col gap-1 text-sm text-brand-950">
          <div className="flex justify-between gap-2">
            <dt>Refund amount</dt>
            <dd className="font-bold">{formatPaise(result.refundAmount)}</dd>
          </div>
          {result.refundId ? (
            <div className="flex justify-between gap-2">
              <dt>Refund reference</dt>
              <dd className="font-mono">{result.refundId}</dd>
            </div>
          ) : null}
        </dl>
        {receipt ? (
          <a
            href={receipt.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-brand-800 hover:underline"
          >
            Download receipt →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Field label="Reason (optional)" htmlFor="reason" hint="Up to 500 characters.">
        <Textarea
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you cancelling?"
        />
      </Field>
      {error ? (
        <div className="mt-4">
          <InlineError message={error.message} recovery={error.recovery} />
        </div>
      ) : null}
      <Button variant="danger" className="mt-4" onClick={() => setConfirming(true)}>
        Cancel this booking
      </Button>
      {confirming ? (
        <ConfirmModal
          title="Cancel booking?"
          body="This cannot be undone. Any eligible refund will be issued per the event's refund policy."
          confirmLabel="Yes, cancel it"
          danger
          busy={busy}
          onConfirm={cancel}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
