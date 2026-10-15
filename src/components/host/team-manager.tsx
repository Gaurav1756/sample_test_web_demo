"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { toList, type TeamMember, type TeamPermission } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const PERMISSIONS: TeamPermission[] = ["manage_event", "scan_tickets"];

function memberKey(m: TeamMember, index: number): string {
  return m.memberId ?? m.id ?? m.userId ?? `row-${index}`;
}

/**
 * Per-event team with scoped permissions (§5, BR-016). Adding a member needs
 * their user id; no user-search endpoint is documented, so hosts paste the
 * id (gap noted in the progress log).
 */
export function TeamManager({ eventId, initial }: { eventId: string; initial: TeamMember[] }) {
  const { notify } = useToast();
  const [members, setMembers] = React.useState(initial);
  const [userId, setUserId] = React.useState("");
  const [perms, setPerms] = React.useState<TeamPermission[]>(["scan_tickets"]);
  const [removing, setRemoving] = React.useState<TeamMember | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = async () => {
    const res = await bff<unknown>(`events/${eventId}/team`);
    setMembers(toList<TeamMember>(res));
  };

  const fail = (e: unknown) => {
    setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
  };

  const togglePerm = (p: TeamPermission) => {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = userId.trim();
    if (!id) {
      setError("Enter the member's user id.");
      return;
    }
    if (perms.length === 0) {
      setError("Choose at least one permission.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${eventId}/team`, {
        method: "POST",
        body: { userId: id, permissions: perms },
      });
      setUserId("");
      setPerms(["scan_tickets"]);
      await reload();
      notify("Team member added.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const changePerms = async (member: TeamMember, permissions: TeamPermission[]) => {
    const key = member.memberId ?? member.id;
    if (!key) {
      setError("This member cannot be edited (no member id returned by the backend).");
      return;
    }
    setError(null);
    try {
      await bff(`events/${eventId}/team/${key}`, { method: "PATCH", body: { permissions } });
      await reload();
      notify("Permissions updated.");
    } catch (err) {
      fail(err);
    }
  };

  const remove = async () => {
    const key = removing?.memberId ?? removing?.id;
    if (!removing || !key) return;
    setBusy(true);
    try {
      await bff(`events/${eventId}/team/${key}`, { method: "DELETE" });
      setRemoving(null);
      await reload();
      notify("Team member removed.");
    } catch (err) {
      fail(err);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {members.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {members.map((m, i) => {
            const label = m.user?.name ?? m.user?.username ?? m.userId ?? `Member ${i + 1}`;
            const active = (m.permissions ?? []) as TeamPermission[];
            return (
              <li
                key={memberKey(m, i)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{label}</p>
                  {m.status ? <p className="text-sm text-stone-500">{m.status}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PERMISSIONS.map((p) => (
                    <label key={p} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={active.includes(p)}
                        disabled={!(m.memberId ?? m.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...active, p]
                            : active.filter((x) => x !== p);
                          void changePerms(m, next);
                        }}
                        className="h-4 w-4 accent-brand-700"
                      />
                      {p === "manage_event" ? "Manage" : "Scan"}
                    </label>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">No team members yet.</p>
      )}

      <form onSubmit={add} className="mt-4 rounded-xl border border-stone-200 p-4">
        <Field
          label="Member user id"
          htmlFor="team-user"
          hint="The teammate's user id (ULID). No user search is available yet."
        >
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User id"
          />
        </Field>
        <fieldset className="mt-3">
          <legend className="mb-1 text-sm font-semibold">Permissions</legend>
          <div className="flex gap-4">
            {PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={perms.includes(p)}
                  onChange={() => togglePerm(p)}
                  className="h-4 w-4 accent-brand-700"
                />
                {p === "manage_event" ? "Manage event" : "Scan tickets"}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={busy} size="sm" className="mt-3">
          {busy ? "Adding…" : "Add member"}
        </Button>
      </form>

      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Remove team member?"
          body="Their access to this event ends immediately."
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
