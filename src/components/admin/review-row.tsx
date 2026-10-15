"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { EventDetail, ReviewQueueItem } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";

type Action = "approve" | "reject" | "suspend" | "remove";

/** Expandable review row with approve/reject/suspend/remove (§13). */
export function ReviewRow({ event, open }: { event: ReviewQueueItem; open: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(open);
  const [detail, setDetail] = React.useState<EventDetail | null>(null);
  const [action, setAction] = React.useState<Action | null>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) {
      try {
        setDetail(await bff<EventDetail>(`events/${event.id}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
      }
    }
  };

  const run = async () => {
    if (!action) return;
    if (action !== "approve" && !text.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`admin/events/${event.id}/${action}`, {
        method: "POST",
        body:
          action === "approve"
            ? text.trim()
              ? { note: text.trim().slice(0, 2000) }
              : {}
            : { reason: text.trim().slice(0, 2000) },
      });
      setAction(null);
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const labels: Record<Action, { title: string; confirm: string; danger?: boolean }> = {
    approve: { title: "Approve event?", confirm: "Approve" },
    reject: { title: "Reject event?", confirm: "Reject", danger: true },
    suspend: { title: "Suspend event?", confirm: "Suspend", danger: true },
    remove: { title: "Remove event?", confirm: "Remove", danger: true },
  };

  return (
    <li className="rounded-xl border border-stone-200">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
      >
        <span>
          <span className="font-semibold">{event.title}</span>
          <span className="mt-0.5 block text-sm text-stone-500">
            {[event.city, formatDateTime(event.startAt)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="text-sm font-semibold text-brand-800">{expanded ? "Hide" : "Review"}</span>
      </button>
      {expanded ? (
        <div className="border-t border-stone-100 p-4">
          {detail ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-stone-500">Venue</dt>
                <dd className="font-medium">{[detail.venue, detail.city].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Schedule</dt>
                <dd className="font-medium">
                  {formatDateTime(detail.startAt)} → {formatDateTime(detail.endAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-stone-500">Description</dt>
                <dd className="whitespace-pre-line">{detail.description}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-stone-500">Loading detail…</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {(["approve", "reject", "suspend", "remove"] as Action[]).map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === "approve" ? "primary" : "secondary"}
                onClick={() => {
                  setAction(a);
                  setText("");
                  setError(null);
                }}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </Button>
            ))}
          </div>
          {error ? (
            <div className="mt-3">
              <InlineError message={error} />
            </div>
          ) : null}
          {action ? (
            <Modal title={labels[action].title} onClose={() => setAction(null)}>
              <p className="text-stone-600">
                {action === "approve"
                  ? "The event publishes and can go on sale."
                  : "The host is notified with your reason. This is recorded in the audit log."}
              </p>
              <div className="mt-4">
                <Field
                  label={action === "approve" ? "Note (optional)" : "Reason (required)"}
                  htmlFor={`reason-${event.id}`}
                >
                  <Textarea
                    value={text}
                    maxLength={2000}
                    onChange={(e) => setText(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" type="button" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant={labels[action].danger ? "danger" : "primary"}
                  disabled={busy || (action !== "approve" && !text.trim())}
                  onClick={run}
                >
                  {busy ? "Working…" : labels[action].confirm}
                </Button>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
