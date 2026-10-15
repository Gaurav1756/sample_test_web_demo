import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Community, type CommunityGroup } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Host chats" };

/** Host chat index: owned communities and their groups. */
export default async function HostChatsPage() {
  await requireSession(["host", "super_admin"]);

  let entries: Array<{ community: Community; groups: CommunityGroup[] }> = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const communities = toList<Community>(await api.get<unknown>("users/me/communities"));
    entries = await Promise.all(
      communities.map(async (community) => ({
        community,
        groups: toList<CommunityGroup>(
          await api.get<unknown>(`communities/${community.id}/groups`).catch(() => [] as unknown),
        ),
      })),
    );
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Chats</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : entries.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {entries.map(({ community, groups }) => (
              <li key={community.id} className="rounded-xl border border-stone-200 p-4">
                <p className="font-semibold">{community.name}</p>
                {groups.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {groups.map((group) => (
                      <li key={group.id}>
                        <Link
                          href={`/host/chats/${group.id}?community=${community.id}`}
                          className="text-sm font-medium text-brand-800 hover:underline"
                        >
                          {group.name ?? "Group chat"} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-stone-500">No groups yet.</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No communities" body="Create a community to open its chats here." />
        )}
      </div>
    </main>
  );
}
