import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type Invoice,
  type LedgerTransaction,
  type Payout,
  type PayoutAccount,
  type PayoutSchedule,
  type TaxInfo,
} from "@/lib/api-types";
import { formatDate, formatDateTime, formatPaise } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { PayoutAccountForm, PayoutAccountRow, PayoutRequestForm } from "@/components/host/finance-forms";

export const metadata: Metadata = { title: "Finance" };

async function section<T>(fn: () => Promise<T>): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await fn() };
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message || e.guidance().message
          : "Something went wrong.",
    };
  }
}

function SectionError({ message }: { message: string }) {
  return <p className="text-sm text-stone-500">{message} (payouts backend pending, CQ-15).</p>;
}

/** Render the returned tax profile scalars. Editing waits on the §16 field set. */
function TaxProfile({ profile }: { profile: TaxInfo }) {
  const rows = Object.entries(profile ?? {}).filter(
    ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  ) as [string, string | number | boolean][];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No tax profile on file. Editable fields are pending the finalized §16 contract.
      </p>
    );
  }
  const label = (key: string) =>
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  return (
    <div>
      <dl className="flex flex-col gap-2">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm"
          >
            <dt className="text-stone-600">{label(k)}</dt>
            <dd className="font-semibold">{String(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-stone-500">
        Editing unlocks once the tax field set is finalized.
      </p>
    </div>
  );
}

/**
 * Host finance (§9/§9a). Every endpoint here is a TBD draft, so each section
 * renders its data or an honest per-section error — never placeholders.
 */
export default async function FinancePage() {
  await requireSession(["host", "super_admin"]);
  const api = await serverApi();

  const [schedule, payouts, transactions, accounts, invoices, tax] = await Promise.all([
    section(() => api.get<PayoutSchedule>("hosts/me/payout-schedule")),
    section(() => api.get<unknown>("hosts/me/payouts").then(toList<Payout>)),
    section(() =>
      api.get<unknown>("hosts/me/transactions", { query: { limit: 20 } }).then(toList<LedgerTransaction>),
    ),
    section(() => api.get<unknown>("hosts/me/payout-accounts").then(toList<PayoutAccount>)),
    section(() => api.get<unknown>("hosts/me/invoices").then(toList<Invoice>)),
    section(() => api.get<TaxInfo>("hosts/me/tax-info")),
  ]);

  return (
    <main>
      <h1 className="font-display text-3xl">Finance</h1>

      <section aria-label="Payout schedule" className="mt-6">
        <h2 className="font-display text-xl">Payouts</h2>
        <div className="mt-3">
          {"error" in schedule ? (
            <SectionError message={schedule.error} />
          ) : (
            <p className="text-sm text-stone-600">
              {schedule.data.policy ?? "Manual payouts, around 5–7 days after each event."}
              {schedule.data.nextEta ? ` Next ETA: ${formatDate(schedule.data.nextEta)}.` : ""}
            </p>
          )}
        </div>
        <div className="mt-4">
          <PayoutRequestForm />
        </div>
        <div className="mt-4">
          {"error" in payouts ? (
            <SectionError message={payouts.error} />
          ) : payouts.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {payouts.data.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm"
                >
                  <span className="font-semibold">{formatPaise(p.netAmount)}</span>
                  <span className="flex items-center gap-3">
                    {p.eta ? <span className="text-stone-500">ETA {formatDate(p.eta)}</span> : null}
                    <StatusBadge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No payouts yet.</p>
          )}
        </div>
      </section>

      <section aria-label="Transactions" className="mt-8">
        <h2 className="font-display text-xl">Transactions</h2>
        <div className="mt-3">
          {"error" in transactions ? (
            <SectionError message={transactions.error} />
          ) : transactions.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {transactions.data.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-stone-500">
                      {t.type} · {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                  <span className={`font-bold ${t.amount < 0 ? "text-red-700" : "text-brand-900"}`}>
                    {formatPaise(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No transactions yet.</p>
          )}
        </div>
      </section>

      <section aria-label="Payout accounts" className="mt-8">
        <h2 className="font-display text-xl">Payout accounts</h2>
        <div className="mt-3">
          {"error" in accounts ? (
            <SectionError message={accounts.error} />
          ) : accounts.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {accounts.data.map((a) => (
                <PayoutAccountRow key={a.id} account={a} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No connected accounts.</p>
          )}
        </div>
        <div className="mt-4">
          <h3 className="font-semibold">Connect an account</h3>
          <div className="mt-2">
            <PayoutAccountForm />
          </div>
        </div>
      </section>

      <section aria-label="Invoices" className="mt-8">
        <h2 className="font-display text-xl">Invoices</h2>
        <div className="mt-3">
          {"error" in invoices ? (
            <SectionError message={invoices.error} />
          ) : invoices.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {invoices.data.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm"
                >
                  <span>
                    <Link
                      href={`/host/finance/invoices/${invoice.id}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      {formatPaise(invoice.amount)}
                    </Link>{" "}
                    · {formatDate(invoice.issuedAt)}
                  </span>
                  <a
                    href={invoice.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-800 hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No invoices yet.</p>
          )}
        </div>
      </section>

      <section aria-label="Tax" className="mt-8">
        <h2 className="font-display text-xl">Tax profile</h2>
        <div className="mt-3">
          {"error" in tax ? (
            <SectionError message={tax.error} />
          ) : (
            <TaxProfile profile={tax.data} />
          )}
        </div>
      </section>
    </main>
  );
}
