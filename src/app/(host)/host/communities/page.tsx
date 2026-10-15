import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Community } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { CommunityCard } from "@/components/communities/community-card";

export const metadata: Metadata = { title: "My communities" };

/**
 * Host communities from GET /users/me/communities (item shape unstated,
 * CQ-08 — tolerated). Ownership is enforced server-side per action.
 */
export default async function HostCommunitiesPage() {
  await requireSession(["host", "super_admin"]);

  let communities: Community[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    communities = toList<Community>(await api.get<unknown>("users/me/communities"));
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">My communities</h1>
        <Link
          href="/host/communities/new"
          className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + New community
        </Link>
      </div>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : communities.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {communities.map((community) => (
              <li key={community.id} className="flex flex-col gap-2">
                <CommunityCard community={community} />
                <Link
                  href={`/host/communities/${community.id}`}
                  className="text-sm font-semibold text-brand-800 hover:underline"
                >
                  Manage →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No communities yet"
            body="Create your first community to bring your audience together."
          />
        )}
      </div>
    </main>
  );
}
