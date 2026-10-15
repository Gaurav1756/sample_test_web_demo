import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Community, type Page } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { CommunityCard } from "@/components/communities/community-card";
import { CommunitySearch } from "@/components/communities/community-search";

export const metadata: Metadata = { title: "Communities" };

const LIMIT = 12;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Community discovery over GET /communities (blocked excluded server-side). */
export default async function CommunitiesPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const search = first(params.search).slice(0, 100);
  const page = Math.max(1, Number(first(params.page)) || 1);

  let communities: Community[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<Community>>("communities", {
      query: { ...(search ? { search } : {}), page, limit: LIMIT },
    });
    communities = toList<Community>(res);
    total = (res as Page<Community>).total ?? communities.length;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Communities</h1>
      <p className="mt-1 text-stone-600">Find your people around the events you love.</p>
      <div className="mt-6 max-w-md">
        <CommunitySearch initial={search} />
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
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communities.map((community) => (
                <li key={community.id}>
                  <CommunityCard community={community} />
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                total={total}
                limit={LIMIT}
                makeHref={(p) => {
                  const q = new URLSearchParams();
                  if (search) q.set("search", search);
                  if (p > 1) q.set("page", String(p));
                  return `/communities?${q.toString()}`;
                }}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="No communities found"
            body="Try another search, or check back later."
          />
        )}
      </div>
    </main>
  );
}
