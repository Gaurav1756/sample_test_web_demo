"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { BlockedMember } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Blocked members (§11f). Blocking removes membership + visibility. */
export function BlockedManager({
  communityId,
  initial,
}: {
  communityId: string;
  initial: BlockedMember[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [userId, setUserId] = React.useState("");
  const [unblocking, setUnblocking] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const block = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = userId.trim();
    if (!id) {
      setError("Enter the user id to block.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/blocked`, { method: "POST", body: { userId: id } });
      setUserId("");
      notify("Member blocked.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const unblock = async () => {
    if (!unblocking) return;
    setBusy(true);
    try {
      await bff(`communities/${communityId}/blocked/${unblocking}`, { method: "DELETE" });
      notify("Member unblocked.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
      setUnblocking(null);
    }
  };

  return (
    <div>
      {initial.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {initial.map((b, i) => {
            const id = b.userId ?? b.user?.id ?? "";
            const label = b.user?.name ?? b.user?.username ?? id ?? `Entry ${i + 1}`;
            return (
              <li
                key={id || i}
                className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5"
              >
                <span className="font-medium">{label}</span>
                <Button variant="secondary" size="sm" disabled={!id} onClick={() => setUnblocking(id)}>
                  Unblock
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">Nobody is blocked.</p>
      )}
      <form onSubmit={block} className="mt-4 flex max-w-md gap-2">
        <div className="flex-1">
          <Field label="Block by user id" htmlFor="block-user">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User id" />
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            Block
          </Button>
        </div>
      </form>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      {unblocking ? (
        <ConfirmModal
          title="Unblock this member?"
          body="They will be able to see and rejoin the community."
          confirmLabel="Unblock"
          busy={busy}
          onConfirm={unblock}
          onCancel={() => setUnblocking(null)}
        />
      ) : null}
    </div>
  );
}
