"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { toList, type CommunityGroup, type PublicUser } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";

export interface MemberRow {
  memberId?: string;
  id?: string;
  user?: PublicUser;
  role?: string;
}

/** Member directory with search, role filter and removal (§11g + group remove). */
export function MembersPane({
  communityId,
  groups,
  initial,
}: {
  communityId: string;
  groups: CommunityGroup[];
  initial: MemberRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState("");
  const [members, setMembers] = React.useState(initial);
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = async (s: string, r: string, g: string) => {
    setError(null);
    try {
      // A selected group lists via GET /groups/:id/members (page/limit
      // only); otherwise the searchable community directory is used.
      const res = g
        ? await bff<unknown>(`groups/${g}/members`, { query: { page: 1, limit: 50 } })
        : await bff<unknown>(`communities/${communityId}/members`, {
            query: {
              ...(s.trim() ? { search: s.trim().slice(0, 100) } : {}),
              ...(r ? { role: r } : {}),
            },
          });
      setMembers(toList<MemberRow>(res));
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    }
  };

  const remove = async () => {
    const memberId = removing?.memberId ?? removing?.id;
    const groupId = groupFilter || groups[0]?.id;
    if (!removing || !memberId || !groupId) {
      setError("This member cannot be removed (missing member or group id).");
      setRemoving(null);
      return;
    }
    setBusy(true);
    try {
      await bff(`groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      setRemoving(null);
      await reload(search, role, groupFilter);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void reload(search, role, groupFilter);
        }}
        className="flex max-w-2xl flex-wrap gap-2"
      >
        <div className="min-w-40 flex-1">
          <Field label="Search" htmlFor="member-search">
            <Input
              value={search}
              maxLength={100}
              disabled={Boolean(groupFilter)}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={groupFilter ? "N/A for groups" : "Name"}
            />
          </Field>
        </div>
        <Field label="Role" htmlFor="member-role">
          <Select value={role} disabled={Boolean(groupFilter)} onChange={(e) => setRole(e.target.value)}>
            <option value="">All</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="member">Member</option>
          </Select>
        </Field>
        {groups.length > 0 ? (
          <Field label="Group" htmlFor="member-group">
            <Select
              value={groupFilter}
              onChange={(e) => {
                const g = e.target.value;
                setGroupFilter(g);
                void reload(search, role, g);
              }}
            >
              <option value="">All groups</option>
              {groups.map((g) =>
                g.id ? (
                  <option key={g.id} value={g.id}>
                    {g.name ?? `Group ${g.id.slice(0, 6)}`}
                  </option>
                ) : null,
              )}
            </Select>
          </Field>
        ) : null}
        <div className="flex items-end">
          <Button type="submit">Filter</Button>
        </div>
      </form>

      {members.length > 0 ? (
        <ul className="mt-4 flex max-w-2xl flex-col gap-2">
          {members.map((m, i) => (
            <li
              key={m.memberId ?? m.id ?? i}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5"
            >
              <div>
                <p className="font-medium">{m.user?.name ?? m.user?.username ?? `Member ${i + 1}`}</p>
                {m.role ? <p className="text-sm text-stone-500">{m.role}</p> : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-stone-500">No members match.</p>
      )}
      {error ? (
        <div className="mt-3 max-w-2xl">
          <InlineError message={error} />
        </div>
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Remove this member?"
          body="They lose access to the group immediately."
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
