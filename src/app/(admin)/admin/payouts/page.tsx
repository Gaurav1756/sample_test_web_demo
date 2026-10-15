import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Page, type Payout } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { PayoutInitiateForm, PayoutRow } from "@/components/admin/payout-forms";

export const metadata: Metadata = { title: "Payout oversight" };

const LIMIT = 10;
const STATUSES = ["pending", "processing", "paid", "failed"] as const;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Payout oversight: list + initiate + status updates (TBD §9, honest states). */
export default async function PayoutsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const status = (STATUSES as readonly string[]).includes(first(params.status))
    ? first(params.status)
    : "";
  const page = Math.max(1, Number(first(params.page)) || 1);

  let payouts: Payout[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<Payout>>("admin/payouts", {
      query: { ...(status ? { status } : {}), page, limit: LIMIT },
    });
    payouts = toList<Payout>(res);
    total = (res as Page<Payout>).total ?? payouts.length;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Payouts</h1>
      <h2 className="mt-6 font-display text-xl">Initiate payout</h2>
      <div className="mt-3">
        <PayoutInitiateForm />
      </div>
      <div className="mt-8">
        <Tabs
          label="Payout status"
          items={[
            { label: "All", href: "/admin/payouts", active: !status },
            ...STATUSES.map((s) => ({
              label: s.charAt(0).toUpperCase() + s.slice(1),
              href: `/admin/payouts?status=${s}`,
              active: status === s,
            })),
          ]}
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
        ) : payouts.length > 0 ? (
          <>
            <ul className="flex flex-col gap-3">
              {payouts.map((payout) => (
                <PayoutRow key={payout.id} payout={payout} />
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                total={total}
                limit={LIMIT}
                makeHref={(p) => {
                  const q = new URLSearchParams();
                  if (status) q.set("status", status);
                  if (p > 1) q.set("page", String(p));
                  return `/admin/payouts?${q.toString()}`;
                }}
              />
            </div>
          </>
        ) : (
          <EmptyState title="No payouts here" body="Payouts with this status will appear here." />
        )}
      </div>
    </main>
  );
}
