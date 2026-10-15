"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { FlaggedHost } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";

type Action = "warn" | "suspend" | "remove";

/** Flagged-host row with verification + enforcement actions (§13). */
export function HostRow({ host }: { host: FlaggedHost }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const [action, setAction] = React.useState<Action | null>(null);
  const [reason, setReason] = React.useState("");
  const [identity, setIdentity] = React.useState("verified");
  const [payout, setPayout] = React.useState("verified");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hostId = host.hostId ?? host.id ?? host.user?.id ?? "";
  const name = host.name ?? host.user?.name ?? host.user?.username ?? hostId;
  const cancellations = host.cancelledCount ?? host.cancelledEvents ?? 0;

  const runAction = async () => {
    if (!action || !hostId) return;
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`admin/hosts/${hostId}/${action}`, {
        method: "POST",
        body: { reason: reason.trim().slice(0, 2000) },
      });
      setAction(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const saveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostId) return;
    setError(null);
    setBusy(true);
    try {
      await bff(`admin/hosts/${hostId}/verification`, {
        method: "POST",
        body: {
          identity,
          payoutAccount: payout,
          ...(note.trim() ? { note: note.trim().slice(0, 2000) } : {}),
        },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-stone-200">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
      >
        <span>
          <span className="font-semibold">{name}</span>
          <span className="mt-0.5 block text-sm text-stone-500">
            {cancellations} cancellations · {host.violations?.length ?? 0} violations
            {host.status ? ` · ${host.status}` : ""}
          </span>
        </span>
        <span className="text-sm font-semibold text-brand-800">{expanded ? "Hide" : "Review"}</span>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-6 border-t border-stone-100 p-4">
          {host.violations && host.violations.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {host.violations.map((v, i) => (
                <li key={i} className="rounded-lg bg-stone-50 px-3 py-2">
                  {v.type} · {formatDateTime(v.createdAt)}
                </li>
              ))}
            </ul>
          ) : null}

          <form onSubmit={saveVerification} className="grid max-w-2xl gap-3 sm:grid-cols-3">
            <Field label="Identity" htmlFor={`identity-${hostId}`}>
              <Select value={identity} onChange={(e) => setIdentity(e.target.value)}>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </Select>
            </Field>
            <Field label="Payout account" htmlFor={`payout-${hostId}`}>
              <Select value={payout} onChange={(e) => setPayout(e.target.value)}>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </Select>
            </Field>
            <Field label="Note" htmlFor={`note-${hostId}`}>
              <Input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit" size="sm" disabled={busy || !hostId}>
                Save verification
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {(["warn", "suspend", "remove"] as Action[]).map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === "warn" ? "secondary" : "primary"}
                onClick={() => {
                  setAction(a);
                  setReason("");
                  setError(null);
                }}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </Button>
            ))}
          </div>
          {error ? <InlineError message={error} /> : null}
          {action ? (
            <Modal
              title={`${action.charAt(0).toUpperCase() + action.slice(1)} host?`}
              onClose={() => setAction(null)}
            >
              <p className="text-stone-600">
                {action === "warn"
                  ? "The host is notified with your reason."
                  : "This is recorded in the audit log and the host is notified."}
              </p>
              <div className="mt-4">
                <Field label="Reason (required)" htmlFor={`reason-${hostId}`}>
                  <Textarea value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
                </Field>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" type="button" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant={action === "warn" ? "primary" : "danger"}
                  disabled={busy || !reason.trim()}
                  onClick={runAction}
                >
                  {busy ? "Working…" : action.charAt(0).toUpperCase() + action.slice(1)}
                </Button>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
