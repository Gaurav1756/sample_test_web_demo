"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/** Editable refund/entry policies (PATCH /events/:id, drafts only server-side). */
export function PoliciesForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: { refundPolicy: string; entryRules: string };
}) {
  const { notify } = useToast();
  const [refundPolicy, setRefundPolicy] = React.useState(initial.refundPolicy);
  const [entryRules, setEntryRules] = React.useState(initial.entryRules);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (refundPolicy.length > 2000 || entryRules.length > 2000) {
      setError("Policies must be 2000 characters or fewer.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${eventId}`, { method: "PATCH", body: { refundPolicy, entryRules } });
      notify("Policies saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-4">
      <Field label="Refund policy" htmlFor="refundPolicy">
        <Textarea value={refundPolicy} maxLength={2000} onChange={(e) => setRefundPolicy(e.target.value)} />
      </Field>
      <Field label="Entry rules" htmlFor="entryRules">
        <Textarea value={entryRules} maxLength={2000} onChange={(e) => setEntryRules(e.target.value)} />
      </Field>
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save policies"}
        </Button>
      </div>
    </form>
  );
}
