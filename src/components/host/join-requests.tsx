"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { JoinRequest } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/** Join-request queue (§11d). */
export function JoinRequests({ communityId, initial }: { communityId: string; initial: JoinRequest[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [denying, setDenying] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const decide = async (reqId: string, action: "approve" | "deny") => {
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/join-requests/${reqId}/${action}`, {
        method: "POST",
        body: action === "deny" && note.trim() ? { note: note.trim().slice(0, 500) } : {},
      });
      notify(action === "approve" ? "Request approved." : "Request denied.");
      setDenying(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (initial.length === 0) {
    return <p className="text-sm text-stone-500">No pending requests.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {initial.map((req) => (
          <li
            key={req.id}
            className="rounded-xl border border-stone-200 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{req.user.name}</p>
                <p className="text-sm text-stone-500">
                  {req.status} · {formatDateTime(req.createdAt)}
                </p>
              </div>
              {req.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => decide(req.id, "approve")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setDenying(denying === req.id ? null : req.id)}
                  >
                    Deny
                  </Button>
                </div>
              ) : null}
            </div>
            {denying === req.id ? (
              <div className="mt-3 flex gap-2">
                <div className="flex-1">
                  <Field label="Note (optional)" htmlFor={`note-${req.id}`}>
                    <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                </div>
                <div className="flex items-end">
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => decide(req.id, "deny")}>
                    Confirm deny
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
    </div>
  );
}
