"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal, Modal } from "@/components/ui/modal";

/** Ownership transfer (owner-only; target must be an admin, §11g). */
export function TransferForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [newOwnerId, setNewOwnerId] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const transfer = async () => {
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/transfer-ownership`, {
        method: "POST",
        body: { newOwnerId: newOwnerId.trim() },
      });
      router.push("/host/communities");
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <Field
        label="New owner user id"
        htmlFor="newOwnerId"
        hint="Must already be an admin. You become an admin."
      >
        <Input value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)} placeholder="User id" />
      </Field>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <Button className="mt-3" disabled={!newOwnerId.trim()} onClick={() => setConfirming(true)}>
        Transfer ownership
      </Button>
      {confirming ? (
        <ConfirmModal
          title="Transfer ownership?"
          body="You will be demoted to admin. This cannot be undone by you."
          confirmLabel="Transfer"
          danger
          busy={busy}
          onConfirm={transfer}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

/** Community deletion (owner-only; confirm=true, §11g). */
export function DeleteCommunityForm({ communityId, name }: { communityId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}?confirm=true`, { method: "DELETE" });
      router.push("/host/communities");
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md rounded-xl border border-red-200 p-5">
      <h3 className="font-display text-lg text-red-900">Delete community</h3>
      <p className="mt-1 text-sm text-red-800">
        Posts, event links and activity are removed. This cannot be undone.
      </p>
      <Button variant="danger" className="mt-3" onClick={() => setConfirming(true)}>
        Delete “{name}”
      </Button>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      {confirming ? (
        <Modal title="Type DELETE to confirm" onClose={() => setConfirming(false)}>
          <p className="text-stone-600">
            Everything in this community will be permanently removed.
          </p>
          <div className="mt-4">
            <Field label="Confirmation" htmlFor="del-confirm">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || text !== "DELETE"} onClick={remove}>
              {busy ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
