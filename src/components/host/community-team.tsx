"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { CommunityTeam, PublicUser } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Admins & moderators (§11c). Only owners add/remove team. */
export function CommunityTeamManager({
  communityId,
  initial,
}: {
  communityId: string;
  initial: CommunityTeam;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState("moderator");
  const [removing, setRemoving] = React.useState<PublicUser | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = userId.trim();
    if (!id) {
      setError("Enter the user id.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/team`, {
        method: "POST",
        body: { userId: id, role },
      });
      setUserId("");
      notify("Team member added.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const memberIdFor = (userId: string): string => {
    const found = initial.members?.find((m) => m.user.id === userId);
    return found?.memberId ?? userId;
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await bff(`communities/${communityId}/team/${memberIdFor(removing.id)}`, { method: "DELETE" });
      notify("Removed from team.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  };

  const groups: Array<[string, PublicUser[] | undefined]> = [
    ["Owner", initial.owner ? [initial.owner] : undefined],
    ["Admins", initial.admins],
    ["Moderators", initial.moderators],
  ];

  return (
    <div>
      {groups.map(([label, people]) =>
        people && people.length > 0 ? (
          <div key={label} className="mb-4">
            <h3 className="text-sm font-semibold text-stone-600">{label}</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2"
                >
                  <span className="font-medium">{p.name}</span>
                  {label !== "Owner" ? (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(p)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      <form onSubmit={add} className="mt-2 grid max-w-lg gap-3 sm:grid-cols-[1fr_140px_auto]">
        <Field label="User id" htmlFor="team-user">
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User id" />
        </Field>
        <Field label="Role" htmlFor="team-role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </div>
      </form>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Remove from team?"
          body={`${removing.name} loses moderation access immediately.`}
          confirmLabel="Remove"
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
