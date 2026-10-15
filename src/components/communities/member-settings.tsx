"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Member self-management: mute, leave, block with confirms (§11k). */
export function MemberSettings({
  communityId,
  communityName,
  groupId,
  isMuted,
  isBlocked,
}: {
  communityId: string;
  communityName: string;
  groupId: string | undefined;
  isMuted: boolean;
  isBlocked: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [muted, setMuted] = React.useState(isMuted);
  const [confirming, setConfirming] = React.useState<"leave" | "block" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");

  const toggleMute = async () => {
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/mute`, { method: muted ? "DELETE" : "POST" });
      setMuted(!muted);
      notify(muted ? "Unmuted." : "Muted. You will not receive notifications.");
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!groupId) return;
    setError(null);
    setBusy(true);
    try {
      await bff(`groups/${groupId}/leave`, { method: "POST" });
      notify("You left the group.");
      router.push("/communities");
      router.refresh();
    } catch (e) {
      fail(e);
      setBusy(false);
      setConfirming(null);
    }
  };

  const block = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isBlocked) {
        await bff(`users/me/blocked-communities/${communityId}`, { method: "DELETE" });
        notify("Community unblocked.");
      } else {
        await bff("users/me/blocked-communities", { method: "POST", body: { communityId } });
        notify("Community blocked.");
      }
      setConfirming(null);
      router.push("/communities");
      router.refresh();
    } catch (e) {
      fail(e);
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section aria-label="Notifications" className="rounded-xl border border-stone-200 p-5">
        <h2 className="font-display text-lg">Notifications</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            {muted ? "Muted — no notifications from this community." : "You receive community updates."}
          </p>
          <Button variant="secondary" size="sm" disabled={busy} onClick={toggleMute}>
            {muted ? "Unmute" : "Mute"}
          </Button>
        </div>
        <p className="mt-3 text-sm">
          <Link href="/settings/notifications" className="font-semibold text-brand-800 hover:underline">
            Global notification preferences →
          </Link>
        </p>
      </section>

      <section aria-label="Membership" className="rounded-xl border border-stone-200 p-5">
        <h2 className="font-display text-lg">Membership</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy || !groupId} onClick={() => setConfirming("leave")}>
            Leave {communityName}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => setConfirming("block")}>
            {isBlocked ? "Unblock" : "Block"}
          </Button>
        </div>
      </section>

      {error ? <InlineError message={error} /> : null}

      {confirming === "leave" ? (
        <ConfirmModal
          title={`Leave ${communityName}?`}
          body="You lose access to its groups and chats. You can rejoin later if it is open."
          confirmLabel="Leave"
          danger
          busy={busy}
          onConfirm={leave}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
      {confirming === "block" ? (
        <ConfirmModal
          title={isBlocked ? `Unblock ${communityName}?` : `Block ${communityName}?`}
          body={
            isBlocked
              ? "It becomes visible again in search and recommendations."
              : "It disappears from search and recommendations, and its notifications stop."
          }
          confirmLabel={isBlocked ? "Unblock" : "Block"}
          danger={!isBlocked}
          busy={busy}
          onConfirm={block}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}
