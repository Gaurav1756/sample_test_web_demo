import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type AuditLog, type Page } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { DataTable } from "@/components/ui/table";
import { AuditFilters } from "@/components/admin/audit-filters";

export const metadata: Metadata = { title: "Audit logs" };

const LIMIT = 20;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Business audit records with documented filters (no export endpoint exists). */
export default async function AuditPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const filters = {
    action: first(params.action).slice(0, 100),
    actorId: first(params.actorId).slice(0, 100),
    entityType: first(params.entityType).slice(0, 100),
    entityId: first(params.entityId).slice(0, 100),
    from: first(params.from),
    to: first(params.to),
  };
  const page = Math.max(1, Number(first(params.page)) || 1);

  let logs: AuditLog[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const query: Record<string, string | number> = { page, limit: LIMIT };
    for (const [k, v] of Object.entries(filters)) {
      if (v) query[k] = v;
    }
    const res = await api.get<Page<AuditLog>>("admin/audit-logs", { query });
    logs = toList<AuditLog>(res);
    total = (res as Page<AuditLog>).total ?? logs.length;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) q.set(k, v);
    }
    if (p > 1) q.set("page", String(p));
    return `/admin/audit?${q.toString()}`;
  };

  return (
    <main>
      <h1 className="font-display text-3xl">Audit logs</h1>
      <div className="mt-6">
        <AuditFilters initial={filters} />
      </div>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : logs.length > 0 ? (
          <>
            <DataTable
              caption="Audit logs"
              columns={[
                { header: "Action", render: (r) => <span className="font-mono">{r.action}</span> },
                { header: "Actor", render: (r) => <span className="font-mono text-xs">{r.actorId}</span> },
                {
                  header: "Entity",
                  render: (r) => (
                    <span className="font-mono text-xs">
                      {r.entityType}/{r.entityId}
                    </span>
                  ),
                },
                { header: "Time", render: (r) => formatDateTime(r.createdAt) },
              ]}
              rows={logs}
            />
            <div className="mt-6">
              <Pagination page={page} total={total} limit={LIMIT} makeHref={href} />
            </div>
          </>
        ) : (
          <EmptyState title="No audit records" body="Actions matching these filters will appear here." />
        )}
      </div>
    </main>
  );
}
