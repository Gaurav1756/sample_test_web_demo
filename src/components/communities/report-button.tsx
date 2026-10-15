"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * Report a message, member, or event (POST /reports). Only target types
 * present in both §11 and §11l are used (CQ-17 keeps `community` out
 * until confirmed).
 */
export function ReportButton({
  targetType,
  targetId,
  variant = "inline",
}: {
  targetType: "message" | "member" | "event";
  targetId: string;
  /** Inline link (chat) or outlined button (detail pages). */
  variant?: "inline" | "outline";
}) {
  const { notify } = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const value = reason.trim();
    if (value.length < 1) {
      setError("Tell us briefly what is wrong.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff("reports", {
        method: "POST",
        body: { targetType, targetId, reason: value.slice(0, 500) },
      });
      setOpen(false);
      setReason("");
      notify("Report submitted. Hosts will review it.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {variant === "outline" ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Report event
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded px-1 text-xs font-medium text-stone-400 hover:text-red-700"
        >
          Report
        </button>
      )}
      {open ? (
        <Modal
          title={targetType === "event" ? "Report this event" : "Report to hosts"}
          onClose={() => setOpen(false)}
        >
          <Field label="What is wrong?" htmlFor={`report-${targetId}`} required>
            <Textarea
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the problem"
            />
          </Field>
          {error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Sending…" : "Submit report"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
