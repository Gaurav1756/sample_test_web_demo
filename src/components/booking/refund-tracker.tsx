"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { toList, type Refund } from "@/lib/api-types";
import { formatDate, formatPaise } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";

/**
 * Refund status tracker (GET /payments/:id/refunds). Re-issue is
 * super_admin-only, so "check again" re-reads status; failures surface
 * the REFUND_FAILED recovery copy.
 */
export function RefundTracker({
  paymentId,
  initial,
}: {
  paymentId: string;
  initial: Refund[] | null;
}) {
  const [refunds, setRefunds] = React.useState<Refund[] | null>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await bff<unknown>(`payments/${paymentId}/refunds`);
      setRefunds(toList<Refund>(res));
    } catch (e) {
      setError(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Refund status</h2>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void load()}>
          {busy ? "Checking…" : "Check again"}
        </Button>
      </div>
      <div className="mt-3">
        {refunds === null && !error ? (
          <p className="text-sm text-stone-600">
            Refund status unavailable. Use Check again to retry.
          </p>
        ) : error ? (
          <InlineError message={error} />
        ) : refunds && refunds.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {refunds.map((r, i) => (
              <li
                key={r.refundId ?? r.id ?? i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-4 py-2.5 text-sm"
              >
                <span className="font-medium">
                  {r.amount != null ? formatPaise(r.amount) : "Refund"}
                  {r.createdAt ? ` · ${formatDate(r.createdAt)}` : ""}
                </span>
                <StatusBadge status={r.status ?? "pending"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">
            No refund issued yet. Eligible refunds appear here once processed.
          </p>
        )}
      </div>
    </div>
  );
}
