import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Page, type Payment, type Refund } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { RefundTracker } from "@/components/booking/refund-tracker";

export const metadata: Metadata = { title: "Payments" };

const LIMIT = 12;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Payment history over GET /users/me/payments (§8, Figma p155-p156). */
export default async function PaymentsPage({ searchParams }: Props) {
  await requireSession();
  const params = (await searchParams) ?? {};
  const rawPage = params.page;
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1);

  let payments: Payment[] = [];
  let total = 0;
  let refundMap = new Map<string, Refund[] | null>();
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<Payment>>("users/me/payments", {
      query: { page, limit: LIMIT },
    });
    payments = toList<Payment>(res);
    total = (res as Page<Payment>).total ?? payments.length;
    const refunded = payments.filter(
      (p) => p.status === "refunded" || p.status === "partially_refunded",
    );
    const settled = await Promise.allSettled(
      refunded.map((p) => api.get<unknown>(`payments/${p.id}/refunds`)),
    );
    refundMap = new Map(
      refunded.map((p, i) => {
        const r = settled[i];
        return [p.id, r.status === "fulfilled" && r.value ? toList<Refund>(r.value) : null];
      }),
    );
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="w-full max-w-3xl">
      <p className="text-sm">
        <Link href="/settings" className="font-semibold text-brand-800 hover:underline">
          ← Settings
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Payments</h1>
      <p className="mt-1 text-sm text-stone-600">
        Your payment history. Saved payment methods are managed at checkout.
      </p>
      {failure ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure.title} body={failure.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : payments.length > 0 ? (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {payments.map((p) => (
              <li key={p.id} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {formatPaise(p.amount)} · {p.gateway}
                    </p>
                    <p className="mt-0.5 text-sm text-stone-600">
                      {formatDateTime(p.createdAt)} ·{" "}
                      <Link
                        href={`/bookings/${p.orderId}`}
                        className="font-medium text-brand-800 hover:underline"
                      >
                        Order
                      </Link>
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.status === "refunded" || p.status === "partially_refunded" ? (
                  <div className="mt-3">
                    <RefundTracker paymentId={p.id} initial={refundMap.get(p.id) ?? null} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Pagination
              page={page}
              total={total}
              limit={LIMIT}
              makeHref={(next) => `/settings/payments?page=${next}`}
            />
          </div>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState title="No payments yet" body="Payments appear here after checkout." />
        </div>
      )}
    </main>
  );
}
