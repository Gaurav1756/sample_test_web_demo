import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Community, type CommunityGroup } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { MemberSettings } from "@/components/communities/member-settings";

export const metadata: Metadata = { title: "Membership settings" };

type Props = { params: Promise<{ id: string }> };

/** Member self-management for one community (§11k). Members only. */
export default async function CommunitySettingsPage({ params }: Props) {
  const { id } = await params;
  await requireSession();

  let community: Community | null = null;
  let groups: CommunityGroup[] = [];
  let missing = false;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [detail, groupRes] = await Promise.all([
      api.get<Community>(`communities/${id}`),
      api.get<unknown>(`communities/${id}/groups`).catch(() => [] as unknown),
    ]);
    community = detail;
    groups = toList<CommunityGroup>(groupRes);
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
      <p className="text-sm">
        <Link href={`/communities/${id}`} className="font-semibold text-brand-800 hover:underline">
          ← Back to community
        </Link>
      </p>
      {failure || !community ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Community unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : community.membershipState !== "member" ? (
        <div className="mt-6">
          <ErrorState
            title="Members only"
            body="Join this community to manage membership settings."
          />
          <p className="mt-4 text-sm">
            <Link
              href={`/communities/${id}`}
              className="font-semibold text-brand-800 hover:underline"
            >
              Back to {community.name} →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <h1 className="mt-2 font-display text-3xl">Membership settings</h1>
          <p className="mt-1 text-sm text-stone-600">{community.name}</p>
          <div className="mt-6">
            <MemberSettings
              communityId={community.id}
              communityName={community.name}
              groupId={groups[0]?.id}
              isMuted={Boolean(community.isMuted)}
              isBlocked={Boolean(community.isBlocked)}
            />
          </div>
        </>
      )}
    </main>
  );
}
