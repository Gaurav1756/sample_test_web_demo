import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type CommunityReport, type Page } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { AdminReportRow } from "@/components/admin/admin-report-row";

export const metadata: Metadata = { title: "Moderation" };

const LIMIT = 10;
const STATUSES = ["open", "actioned", "dismissed"] as const;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Platform moderation queue from POST /reports (§13). */
export default async function ModerationPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const status = (STATUSES as readonly string[]).includes(first(params.status))
    ? first(params.status)
    : "open";
  const page = Math.max(1, Number(first(params.page)) || 1);

  let reports: CommunityReport[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<CommunityReport>>("admin/reports", {
      query: { status, page, limit: LIMIT },
    });
    reports = toList<CommunityReport>(res);
    total = (res as Page<CommunityReport>).total ?? reports.length;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Moderation</h1>
      <div className="mt-4">
        <Tabs
          label="Report status"
          items={STATUSES.map((s) => ({
            label: s.charAt(0).toUpperCase() + s.slice(1),
            href: `/admin/moderation?status=${s}`,
            active: status === s,
          }))}
        />
      </div>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : reports.length > 0 ? (
          <>
            <ul className="flex flex-col gap-3">
              {reports.map((report) => (
                <AdminReportRow key={report.id} report={report} />
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                total={total}
                limit={LIMIT}
                makeHref={(p) => {
                  const q = new URLSearchParams({ status });
                  if (p > 1) q.set("page", String(p));
                  return `/admin/moderation?${q.toString()}`;
                }}
              />
            </div>
          </>
        ) : (
          <EmptyState title="No reports here" body="Reports with this status will appear here." />
        )}
      </div>
    </main>
  );
}
