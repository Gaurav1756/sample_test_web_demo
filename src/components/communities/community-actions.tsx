"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { JoinResult, MembershipState } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Membership controls: join/leave, mute, block (§11, §11k). */
export function CommunityActions({
  communityId,
  communityName,
  groupId,
  membership,
  isMuted,
  isBlocked,
  signedIn,
}: {
  communityId: string;
  communityName: string;
  groupId: string | undefined;
  membership: MembershipState | undefined;
  isMuted: boolean;
  isBlocked: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (fn: () => Promise<JoinResult | unknown>, done: string) => {
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/communities/${communityId}`)}`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = (await fn()) as JoinResult | null;
      // The join abuse warning must be displayed (§11, COM-03).
      if (res && typeof res === "object" && "communityWarning" in res && res.communityWarning) {
        setWarning(res.communityWarning);
      } else {
        notify(done);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const needGroup = groupId === undefined;

  return (
    <div className="flex flex-wrap gap-2">
      {membership === "member" ? (
        <Button variant="secondary" disabled={busy || needGroup} onClick={() => run(() => bff(`groups/${groupId}/leave`, { method: "POST" }), "You left the group.")}>
          Leave
        </Button>
      ) : membership === "pending" ? (
        <Button variant="secondary" disabled>
          Request pending
        </Button>
      ) : membership === "blocked" || isBlocked ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(() => bff(`users/me/blocked-communities/${communityId}`, { method: "DELETE" }), "Community unblocked.")
          }
        >
          Unblock
        </Button>
      ) : (
        <Button disabled={busy || needGroup} onClick={() => run(() => bff<JoinResult>(`groups/${groupId}/join`, { method: "POST" }), `You joined ${communityName}.`)}>
          Join
        </Button>
      )}
      {membership === "member" ? (
        <Button
          variant="secondary"
          disabled={busy || needGroup}
          onClick={() =>
            run(
              () =>
                isMuted
                  ? bff(`communities/${communityId}/mute`, { method: "DELETE" })
                  : bff(`communities/${communityId}/mute`, { method: "POST" }),
              isMuted ? "Unmuted." : "Muted.",
            )
          }
        >
          {isMuted ? "Unmute" : "Mute"}
        </Button>
      ) : null}
      {membership !== "blocked" && !isBlocked ? (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(
              () => bff("users/me/blocked-communities", { method: "POST", body: { communityId } }),
              "Community blocked.",
            )
          }
        >
          Block
        </Button>
      ) : null}
      {error ? (
        <div className="w-full">
          <InlineError message={error} />
        </div>
      ) : null}
      {warning ? (
        <Modal title="Before you join" onClose={() => setWarning(null)}>
          <p className="whitespace-pre-line text-stone-700">{warning}</p>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setWarning(null)}>Understood</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
