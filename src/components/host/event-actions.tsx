"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { EventStatus } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Lifecycle actions for one owned event: submit, reschedule, cancel (§5). */
export function EventActions({ eventId, status }: { eventId: string; status: EventStatus }) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [newStart, setNewStart] = React.useState("");
  const [newEnd, setNewEnd] = React.useState("");

  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");

  const submitReview = async () => {
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${eventId}/submit-review`, { method: "POST" });
      notify("Submitted for review.");
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setSubmitting(false);
    }
  };

  const reschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStart || !newEnd) {
      setError("New start and end are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${eventId}/reschedule`, {
        method: "POST",
        body: { newStartAt: new Date(newStart).toISOString(), newEndAt: new Date(newEnd).toISOString() },
      });
      notify("Event rescheduled. Ticket holders are notified by the backend.");
      setRescheduling(false);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const cancellable = !["cancelled", "completed"].includes(status);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <>
          <Button asChild variant="secondary">
            <Link href={`/host/events/new/1?draft=${eventId}`}>Edit draft</Link>
          </Button>
          <Button onClick={() => setSubmitting(true)}>Submit for review</Button>
        </>
      ) : null}
      {!["draft", "cancelled", "completed"].includes(status) ? (
        <Button variant="secondary" onClick={() => setRescheduling(true)}>
          Reschedule
        </Button>
      ) : null}
      {cancellable ? (
        <Button asChild variant="secondary">
          <Link href={`/host/events/${eventId}/cancel`}>Cancel event…</Link>
        </Button>
      ) : null}
      {error ? (
        <div className="w-full">
          <InlineError message={error} />
        </div>
      ) : null}

      {submitting ? (
        <ConfirmModal
          title="Submit for review?"
          body="The event goes to the Super Admin review queue. You cannot edit it while it is under review."
          confirmLabel="Submit"
          busy={busy}
          onConfirm={submitReview}
          onCancel={() => setSubmitting(false)}
        />
      ) : null}
      {rescheduling ? (
        <Modal title="Reschedule event" onClose={() => setRescheduling(false)}>
          <form onSubmit={reschedule} className="flex flex-col gap-3">
            <Field label="New start" htmlFor="newStart">
              <Input
                type="datetime-local"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </Field>
            <Field label="New end" htmlFor="newEnd">
              <Input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRescheduling(false)}>
                Close
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Reschedule"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
