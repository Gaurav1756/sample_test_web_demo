import type { CheckinRecord } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { DataTable } from "@/components/ui/table";

/** Check-in monitor with tolerant rows (item shape unstated, CQ-08). */
export function CheckinsTable({ rows }: { rows: CheckinRecord[] }) {
  const normalized = rows.map((r, i) => ({
    id: r.ticketCode ?? `row-${i}`,
    code: r.ticketCode ?? "—",
    attendee: r.attendee ?? "—",
    tier: r.tierName ?? "—",
    status: r.status ?? "—",
    at: r.checkedInAt ?? r.scannedAt ?? null,
  }));

  return (
    <DataTable
      caption="Check-in monitor"
      columns={[
        { header: "Ticket", render: (r) => <span className="font-mono">{r.code}</span> },
        { header: "Attendee", render: (r) => r.attendee },
        { header: "Tier", render: (r) => r.tier },
        { header: "Status", render: (r) => r.status },
        { header: "Time", render: (r) => (r.at ? formatDateTime(r.at) : "—") },
      ]}
      rows={normalized}
    />
  );
}
