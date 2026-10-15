import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser, requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type BlockedMember,
  type Community,
  type CommunityGroup,
  type CommunityTeam,
  type CursorPage,
  type DataSummary,
  type ExportJob,
  type JoinRequest,
  type CommunityReport,
  type Post,
} from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { PostCard } from "@/components/communities/post-card";
import { CommunitySettingsForms } from "@/components/host/community-settings-forms";
import { CommunityTeamManager } from "@/components/host/community-team";
import { JoinRequests } from "@/components/host/join-requests";
import { ReportsManager } from "@/components/host/reports-manager";
import { BlockedManager } from "@/components/host/blocked-manager";
import { MembersPane, type MemberRow } from "@/components/host/members-pane";
import { CommunityInfoForm, GroupCreateForm } from "@/components/host/community-info-form";
import { DataPane } from "@/components/host/data-pane";
import { AnnounceForm } from "@/components/host/announce-form";
import { DeleteCommunityForm, TransferForm } from "@/components/host/danger-zone";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const api = await serverApi();
    const community = await api.get<Community>(`communities/${id}`);
    return { title: `Manage ${community.name}` };
  } catch {
    return { title: "Manage community" };
  }
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const SECTIONS = [
  "info",
  "settings",
  "posts",
  "team",
  "requests",
  "reports",
  "blocked",
  "members",
  "data",
  "danger",
] as const;

export default async function ManageCommunityPage({ params, searchParams }: Props) {
  await requireSession(["host", "super_admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const section = (SECTIONS as readonly string[]).includes(first(query.section))
    ? first(query.section)
    : "settings";
  const user = await getSessionUser();

  let community: Community | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  // Section payloads (fetched only for the active section).
  let requests: JoinRequest[] = [];
  let reports: CommunityReport[] = [];
  let blocked: BlockedMember[] = [];
  let team: CommunityTeam | null = null;
  let members: MemberRow[] = [];
  let groups: CommunityGroup[] = [];
  let summary: DataSummary | null = null;
  let jobs: ExportJob[] = [];
  let posts: Post[] = [];
  let categories: string[] = [];

  try {
    const api = await serverApi();
    community = await api.get<Community>(`communities/${id}`);
    if (section === "requests") {
      const status = ["pending", "decided"].includes(first(query.status)) ? first(query.status) : "pending";
      requests = toList<JoinRequest>(
        await api.get<unknown>(`communities/${id}/join-requests`, { query: { status } }),
      );
    } else if (section === "reports") {
      const status = first(query.status);
      reports = toList<CommunityReport>(
        await api.get<unknown>(`communities/${id}/reports`, {
          query: status ? { status } : {},
        }),
      );
    } else if (section === "blocked") {
      blocked = toList<BlockedMember>(await api.get<unknown>(`communities/${id}/blocked`));
    } else if (section === "team") {
      team = await api.get<CommunityTeam>(`communities/${id}/team`);
    } else if (section === "members") {
      const [memberRes, groupRes] = await Promise.all([
        api.get<unknown>(`communities/${id}/members`),
        api.get<unknown>(`communities/${id}/groups`),
      ]);
      members = toList(memberRes);
      groups = toList<CommunityGroup>(groupRes);
    } else if (section === "data") {
      const [summaryRes, jobRes] = await Promise.all([
        api.get<DataSummary>(`communities/${id}/data-summary`),
        api.get<unknown>(`communities/${id}/exports`),
      ]);
      summary = summaryRes;
      jobs = toList<ExportJob>(jobRes);
    } else if (section === "posts") {
      const res = await api.get<CursorPage<Post>>(`communities/${id}/posts`);
      posts = res.data;
    } else if (section === "info") {
      categories = await api
        .get<string[]>("meta/categories", { auth: false })
        .catch(() => [] as string[]);
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

  const tab = (s: string, label: string) => ({
    label,
    href: `/host/communities/${id}?section=${s}`,
    active: section === s,
  });

  return (
    <main>
      <p className="text-sm">
        <Link href="/host/communities" className="font-semibold text-brand-800 hover:underline">
          ← My communities
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
      ) : (
        <>
          <h1 className="mt-2 font-display text-3xl">Manage {community.name}</h1>
          <div className="mt-4">
            <Tabs
              label="Management"
              items={[
                tab("info", "Info"),
                tab("settings", "Settings"),
                tab("posts", "Posts"),
                tab("team", "Team"),
                tab("requests", "Requests"),
                tab("reports", "Reports"),
                tab("blocked", "Blocked"),
                tab("members", "Members"),
                tab("data", "Data"),
                tab("danger", "Danger"),
              ]}
            />
          </div>
          <div className="mt-6">
            {section === "info" ? (
              community ? (
                <CommunityInfoForm community={community} categories={categories} />
              ) : null
            ) : null}
            {section === "settings" ? <CommunitySettingsForms communityId={id} /> : null}
            {section === "posts" ? (
              <div className="flex max-w-3xl flex-col gap-6">
                <AnnounceForm communityId={id} />
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <PostCard key={post.id} post={post} signedIn={Boolean(user)} />
                  ))
                ) : (
                  <EmptyState title="No posts yet" body="Publish the first one above." />
                )}
              </div>
            ) : null}
            {section === "team" && team ? (
              <CommunityTeamManager communityId={id} initial={team} />
            ) : null}
            {section === "requests" ? (
              <JoinRequests communityId={id} initial={requests} />
            ) : null}
            {section === "reports" ? (
              <ReportsManager communityId={id} initial={reports} />
            ) : null}
            {section === "blocked" ? (
              <BlockedManager communityId={id} initial={blocked} />
            ) : null}
            {section === "members" ? (
              <div className="flex flex-col gap-8">
                <div>
                  <h2 className="font-display text-xl">Groups</h2>
                  {groups.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {groups.map((g) => (
                        <li key={g.id} className="rounded-xl border border-soft bg-surface-card p-3 text-sm">
                          <span className="font-semibold">{g.name}</span>
                          {typeof g.memberCount === "number" ? (
                            <span className="text-ink-soft"> · {g.memberCount} members</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-soft">No groups yet.</p>
                  )}
                  <div className="mt-4">
                    <GroupCreateForm communityId={id} />
                  </div>
                </div>
                <MembersPane communityId={id} groups={groups} initial={members} />
              </div>
            ) : null}
            {section === "data" && summary ? (
              <DataPane communityId={id} summary={summary} jobs={jobs} />
            ) : null}
            {section === "danger" ? (
              <div className="flex flex-col gap-8">
                <div>
                  <h2 className="font-display text-xl">Transfer ownership</h2>
                  <div className="mt-3">
                    <TransferForm communityId={id} />
                  </div>
                </div>
                <DeleteCommunityForm communityId={id} name={community.name} />
              </div>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
