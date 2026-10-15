"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { EventCard } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Clone a completed event into a new draft (§5 rehost). */
export function RehostButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const rehost = async () => {
    setBusy(true);
    try {
      const draft = await bff<EventCard>(`events/${eventId}/rehost`, { method: "POST" });
      notify(`Draft created from “${title}”.`);
      router.push(`/host/events/${draft.id}`);
    } catch (e) {
      notify(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        Rehost
      </Button>
      {confirming ? (
        <ConfirmModal
          title="Rehost this event?"
          body={`A new draft will be created from “${title}”.`}
          confirmLabel="Rehost"
          busy={busy}
          onConfirm={rehost}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
