"use client";

import { buildIcs, downloadIcs, type CalendarEvent } from "@/lib/ics";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Client-side .ics download built from data the app already holds. */
export function AddToCalendarButton({
  event,
  filename,
}: {
  event: CalendarEvent;
  filename: string;
}) {
  const { notify } = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        const body = buildIcs(event);
        if (!body) {
          notify("Event date unavailable.");
          return;
        }
        downloadIcs(filename, body);
        notify("Calendar file downloaded.");
      }}
    >
      Add to calendar
    </Button>
  );
}
