/**
 * Minimal ICS (calendar file) builder for the client-side "add to
 * calendar" action. No backend involved: the file is generated from
 * ticket/order data the app already holds.
 */

function icsDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface CalendarEvent {
  title: string;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  description?: string | null;
  uid?: string;
}

/** Build an .ics file body, or null when the start date is unusable. */
export function buildIcs(event: CalendarEvent): string | null {
  const start = icsDate(event.startAt);
  if (!start) return null;
  const end = event.endAt ? icsDate(event.endAt) : null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pegwin Circle//Bookings//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid ?? `${Date.now()}@pegwin.circle`}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    ...(end ? [`DTEND:${end}`] : []),
    `SUMMARY:${escape(event.title)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escape(event.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** Trigger a download of the given .ics body. */
export function downloadIcs(filename: string, body: string): void {
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
