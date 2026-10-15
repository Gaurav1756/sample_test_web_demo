"use client";

import { useActionState } from "react";
import { deleteAccount, updateVisibility } from "@/lib/account-actions";
import type { User } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import * as React from "react";

const INITIAL = { ok: false as const };

export function AccountSettingsForm({ user }: { user: User }) {
  const [visState, visAction, visPending] = useActionState(updateVisibility, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteAccount, INITIAL);
  const [confirming, setConfirming] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <form action={visAction}>
        <h2 className="font-display text-xl">Privacy</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="profileVisible"
            defaultChecked={user.visibility?.profileVisible !== false}
            className="h-4 w-4 accent-brand-700"
          />
          Public profile (only city-level location is ever shown)
        </label>
        {visState.message ? (
          <div className="mt-3">
            {visState.ok ? (
              <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
                {visState.message}
              </p>
            ) : (
              <InlineError message={visState.message} recovery={visState.recovery} />
            )}
          </div>
        ) : null}
        <Button type="submit" disabled={visPending} className="mt-4">
          {visPending ? "Saving…" : "Save privacy"}
        </Button>
      </form>

      <div className="rounded-xl border border-red-200 p-5">
        <h2 className="font-display text-xl text-red-900">Delete account</h2>
        <p className="mt-1 text-sm text-red-800">
          Deletion is scheduled and cannot be undone. Personal data is removed;
          financial records are retained as required by law.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
        {confirming ? (
          <Modal title="Type DELETE to confirm" onClose={() => setConfirming(false)}>
            <p className="text-stone-600">
              Your profile, bookings history and community memberships will be scheduled for
              removal, and you will be signed out.
            </p>
            <form action={delAction} className="mt-4 flex flex-col gap-3">
              <Field label="Confirmation" htmlFor="confirm">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  name="confirm"
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </Field>
              {delState.message && !delState.ok ? (
                <InlineError message={delState.message} recovery={delState.recovery} />
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" type="button" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="danger" type="submit" disabled={delPending || confirmText !== "DELETE"}>
                  {delPending ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </form>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
