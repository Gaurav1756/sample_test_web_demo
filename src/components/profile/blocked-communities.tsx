"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { InlineError, EmptyState } from "@/components/ui/states";

/** Blocked communities list with unblock (GET/DELETE /users/me/blocked-communities, §11k). */
export function BlockedCommunities({
  initial,
}: {
  initial: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const unblock = async (id: string) => {
    setError(null);
    setBusy(id);
    try {
      await bff(`users/me/blocked-communities/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  if (initial.length === 0) {
    return <EmptyState title="No blocked communities" body="Blocked communities will appear here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {initial.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-soft bg-surface-card p-3 text-sm"
          >
            <Link href={`/communities/${c.id}`} className="font-semibold hover:underline">
              {c.name}
            </Link>
            <Button
              variant="secondary"
              disabled={busy === c.id}
              onClick={() => unblock(c.id)}
            >
              {busy === c.id ? "Unblocking…" : "Unblock"}
            </Button>
          </li>
        ))}
      </ul>
      {error ? <InlineError message={error} /> : null}
    </div>
  );
}
