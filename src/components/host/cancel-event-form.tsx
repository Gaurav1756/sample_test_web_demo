"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";

/**
 * Host event cancellation (BRD §5.9). The backend notifies holders and
 * triggers refunds; cancellations count toward the ≥3 enforcement flag.
 * The response shape is unstated (CQ-07), so only status is shown.
 */
export function CancelEventForm({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [summary, setSummary] = React.useState<Array<[string, string]>>([]);
  const [error, setError] = React.useState<string | null>(null);

  const cancel = async () => {
    setError(null);
    setBusy(true);
    try {
      // CQ-07: response shape unstated — surface any returned summary scalars.
      const res = await bff<unknown>(`events/${eventId}/cancel`, {
        method: "POST",
        body: { reason: reason.trim().slice(0, 500) },
      });
      if (res && typeof res === "object" && !Array.isArray(res)) {
        const rows = Object.entries(res as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
          .map(([k, v]) => [k, String(v)] as [string, string]);
        setSummary(rows);
      }
      setDone(true);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
        <h2 className="font-display text-xl text-brand-900">Event cancelled</h2>
        <p className="mt-2 text-sm text-brand-950">
          Ticket holders are being notified and eligible refunds issued by the backend.
        </p>
        {summary.length > 0 ? (
          <dl className="mt-4 flex flex-col gap-1 text-sm text-brand-950">
            {summary.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="capitalize">{k.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Button className="mt-4" onClick={() => router.push(`/host/events/${eventId}`)}>
          Back to event
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Field
        label="Reason"
        htmlFor="reason"
        hint="Required, up to 500 characters. Shared with the review trail."
        required
      >
        <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Cancelling is irreversible, counts toward your account&apos;s cancellation record (3 or more
        triggers a review), and notifies all ticket holders.
      </div>
      {error ? (
        <div className="mt-4">
          <InlineError message={error} />
        </div>
      ) : null}
      <Button
        variant="danger"
        className="mt-4"
        disabled={!reason.trim()}
        onClick={() => setConfirming(true)}
      >
        Cancel “{title}”
      </Button>
      {confirming ? (
        <ConfirmModal
          title="Cancel this event?"
          body="This cannot be undone. Holders will be notified and refunds issued per policy."
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
