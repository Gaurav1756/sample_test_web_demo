import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type Community,
  type CommunityGroup,
  type CursorPage,
  type EventCard as EventCardData,
  type Post,
} from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EventCard } from "@/components/events/event-card";
import { SaveButton } from "@/components/events/save-button";
import { CommunityActions } from "@/components/communities/community-actions";
import { MemberComposer } from "@/components/communities/member-composer";
import { PostCard } from "@/components/communities/post-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const api = await serverApi();
    const community = await api.get<Community>(`communities/${id}`);
    return { title: community.name };
  } catch {
    return { title: "Community" };
  }
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CommunityDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();

  let community: Community | null = null;
  let groups: CommunityGroup[] = [];
  let members: Array<{ id: string; name: string }> | null = null;
  let posts: Post[] | null = [];
  let upcoming: EventCardData[] | null = [];
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    community = await api.get<Community>(`communities/${id}`);
    const [groupRes, postRes, eventRes] = await Promise.all([
      api.get<unknown>(`communities/${id}/groups`),
      api.get<CursorPage<Post>>(`communities/${id}/posts`).catch(() => null),
      api.get<unknown>(`communities/${id}/events`, { query: { upcoming_only: true } }).catch(() => null),
    ]);
    groups = toList<CommunityGroup>(groupRes);
    posts = postRes ? postRes.data : null;
    upcoming = eventRes === null ? null : toList<EventCardData>(eventRes);
    // Member directory: permission-gated server-side; hidden when disallowed.
    if (user && community.membershipState === "member") {
      try {
        const raw = toList<{ user?: { id: string; name: string }; name?: string; id?: string }>(
          await api.get<unknown>(`communities/${id}/members`, { query: { limit: 12 } }),
        );
        members = raw
          .map((m) => ({ id: m.user?.id ?? m.id ?? "", name: m.user?.name ?? m.name ?? "" }))
          .filter((m) => m.id && m.name);
      } catch {
        members = null;
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      missing = true;
    } else {
      const g =
        e instanceof ApiError
          ? e.guidance()
          : { message: "Something went wrong.", recovery: "Please try again." };
      failure = { title: g.message, body: g.recovery };
    }
  }

  if (missing) notFound();

  return (
    <main>
      {failure || !community ? (
        <>
          <ErrorState title={failure?.title ?? "Community unavailable."} body={failure?.body} />
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 font-display text-2xl font-bold text-brand-900"
              >
                {community.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <h1 className="font-display text-3xl">{community.name}</h1>
                <p className="mt-1 text-stone-600">
                  {community.stats?.members ?? "—"} members ·{" "}
                  {community.stats?.eventsHosted ?? "—"} events
                  {community.stats?.avgRating != null
                    ? ` · ★ ${community.stats.avgRating.toFixed(1)}`
                    : ""}
                </p>
              </div>
            </div>
            <SaveButton kind="community" id={community.id} />
          </div>

          {community.description ? (
            <p className="mt-4 max-w-3xl leading-relaxed text-stone-700">{community.description}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CommunityActions
              communityId={community.id}
              communityName={community.name}
              groupId={groups[0]?.id}
              membership={community.membershipState}
              isMuted={Boolean(community.isMuted)}
              isBlocked={Boolean(community.isBlocked)}
              signedIn={Boolean(user)}
            />
            {community.membershipState === "member" && groups[0] ? (
              <Link
                href={`/communities/${community.id}/chat?group=${groups[0].id}`}
                className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Open chat →
              </Link>
            ) : null}
            {community.membershipState === "member" ? (
              <Link
                href={`/communities/${community.id}/settings`}
                className="inline-flex h-10 items-center rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                Membership settings
              </Link>
            ) : null}
          </div>

          <h2 className="mt-10 font-display text-2xl">Upcoming events</h2>
          <div className="mt-4">
            {upcoming === null ? (
              <p className="text-sm text-stone-500">Events couldn&apos;t be loaded right now.</p>
            ) : upcoming.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No upcoming events" body="New events will appear here." />
            )}
          </div>

          {members && members.length > 0 ? (
            <>
              <h2 className="mt-10 font-display text-2xl">Members</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {members.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/users/${m.id}`}
                      className="inline-block rounded-full border border-soft bg-surface-card px-3 py-1 text-sm font-semibold hover:underline"
                    >
                      {m.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="mt-10 font-display text-2xl">Posts</h2>
          {community.membershipState === "member" && user ? (
            <div className="mt-4 max-w-3xl">
              <MemberComposer communityId={community.id} />
            </div>
          ) : null}
          <div className="mt-4 flex max-w-3xl flex-col gap-3">
            {posts === null ? (
              <p className="text-sm text-stone-500">Posts couldn&apos;t be loaded right now.</p>
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} signedIn={Boolean(user)} />
              ))
            ) : (
              <EmptyState title="No posts yet" body="Be the first to start a discussion." />
            )}
          </div>
        </>
      )}
    </main>
  );
}
