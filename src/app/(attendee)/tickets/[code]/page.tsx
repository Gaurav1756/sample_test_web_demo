import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { Ticket } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { TicketQr } from "@/components/booking/ticket-qr";
import { AddToCalendarButton } from "@/components/booking/add-to-calendar";

export const metadata: Metadata = { title: "Ticket" };

type Props = {
  params: Promise<{ code: string }>;
};

export default async function TicketPage({ params }: Props) {
  await requireSession();
  const { code } = await params;

  let ticket: Ticket | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    ticket = await api.get<Ticket>(`tickets/${code}`);
  } catch (e) {
    if (e instanceof ApiError && (e.code === "TICKET_INVALID_OR_EXPIRED" || e.status === 404)) {
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
    <main className="mx-auto w-full max-w-2xl">
      <p className="text-sm">
        <Link href="/bookings" className="font-semibold text-brand-800 hover:underline">
          ← All bookings
        </Link>
      </p>
      {failure || !ticket ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Ticket unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center text-center">
          <StatusBadge status={ticket.status} />
          <h1 className="mt-3 font-display text-3xl">{ticket.event.title}</h1>
          <p className="mt-1 text-stone-600">
            {formatDateTime(ticket.event.startAt)}
            {ticket.event.venue ? ` · ${ticket.event.venue}` : ""}
          </p>
          <div className="mt-6">
            <TicketQr payload={ticket.qrPayload} />
          </div>
          <dl className="mt-6 grid w-full gap-2 rounded-xl border border-stone-200 p-5 text-left text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-stone-500">Ticket code</dt>
              <dd className="font-mono font-bold">{ticket.ticketCode}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-stone-500">Attendee</dt>
              <dd className="font-medium">{ticket.attendee.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-stone-500">Tier</dt>
              <dd className="font-medium">{ticket.tierName}</dd>
            </div>
            {ticket.checkedInAt ? (
              <div className="flex justify-between gap-2">
                <dt className="text-stone-500">Checked in</dt>
                <dd className="font-medium">{formatDateTime(ticket.checkedInAt)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4">
            <AddToCalendarButton
              event={{
                title: ticket.event.title,
                startAt: ticket.event.startAt,
                location: [ticket.event.venue, ticket.event.address].filter(Boolean).join(", ") || null,
                uid: `${ticket.ticketCode}@pegwin.circle`,
              }}
              filename={ticket.event.title}
            />
          </div>
          <p className="mt-4 text-sm text-stone-500">
            Tickets are non-transferable. Show this QR at the gate.
          </p>
        </div>
      )}
    </main>
  );
}
