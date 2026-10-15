import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { Invoice } from "@/lib/api-types";
import { formatDate, formatPaise } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Invoice" };

type Props = { params: Promise<{ invoiceId: string }> };

/** Invoice detail + download (GET /hosts/me/invoices/:id, §9a). */
export default async function InvoiceDetailPage({ params }: Props) {
  const { invoiceId } = await params;
  await requireSession(["host", "super_admin"]);

  let invoice: Invoice | null = null;
  let missing = false;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    invoice = await api.get<Invoice>(`hosts/me/invoices/${invoiceId}`);
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
        <Link href="/host/finance" className="font-semibold text-brand-800 hover:underline">
          ← Finance
        </Link>
      </p>
      {failure || !invoice ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Invoice unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-2 font-display text-3xl">Invoice</h1>
          <dl className="mt-6 flex max-w-lg flex-col gap-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm">
              <dt className="text-stone-600">Amount</dt>
              <dd className="font-bold">{formatPaise(invoice.amount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm">
              <dt className="text-stone-600">Issued</dt>
              <dd className="font-semibold">{formatDate(invoice.issuedAt)}</dd>
            </div>
            {invoice.eventId ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm">
                <dt className="text-stone-600">Event</dt>
                <dd>
                  <Link
                    href={`/host/events/${invoice.eventId}`}
                    className="font-semibold text-brand-800 hover:underline"
                  >
                    View event
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          <a
            href={invoice.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Download invoice
          </a>
        </>
      )}
    </main>
  );
}
