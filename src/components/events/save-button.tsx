"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { useToast } from "@/components/ui/toast";

/** Save/unsave toggle for events and communities (§12a). Idempotent server-side. */
export function SaveButton({
  kind,
  id,
  initialSaved,
}: {
  kind: "event" | "community";
  id: string;
  initialSaved?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useToast();
  const [saved, setSaved] = React.useState(Boolean(initialSaved));
  const [busy, setBusy] = React.useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const base = kind === "event" ? "users/me/saved-events" : "users/me/saved-communities";
    try {
      if (saved) {
        await bff(`${base}/${id}`, { method: "DELETE" });
        setSaved(false);
        notify("Removed from saved.");
      } else {
        await bff(base, {
          method: "POST",
          body: kind === "event" ? { eventId: id } : { communityId: id },
        });
        setSaved(true);
        notify("Saved.");
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }
      notify(err instanceof ApiError ? err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`rounded-full p-2 shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
        saved ? "bg-brand-700 text-white" : "bg-white/90 text-stone-700 hover:bg-white"
      }`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {saved ? "♥" : "♡"}
      </span>
    </button>
  );
}
