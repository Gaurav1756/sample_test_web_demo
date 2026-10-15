import { describe, expect, it } from "vitest";
import { buildIcs } from "../src/lib/ics";

describe("buildIcs", () => {
  it("builds a valid calendar body from ticket data", () => {
    const body = buildIcs({
      title: "Rooftop Indie Sessions",
      startAt: "2026-08-18T18:30:00Z",
      endAt: "2026-08-18T21:30:00Z",
      location: "Skyline Terrace, Delhi",
      uid: "ABC123@pegwin.circle",
    });
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:Rooftop Indie Sessions");
    expect(body).toContain("DTSTART:20260818T183000Z");
    expect(body).toContain("DTEND:20260818T213000Z");
    expect(body).toContain("UID:ABC123@pegwin.circle");
    expect(body).toContain("END:VEVENT");
    expect(body).toContain("END:VCALENDAR");
  });

  it("escapes ICS special characters", () => {
    const body = buildIcs({
      title: "Meetup; food, fun\nall",
      startAt: "2026-08-18T18:30:00Z",
    });
    expect(body).toContain("SUMMARY:Meetup\\; food\\, fun\\nall");
  });

  it("omits optional fields when absent", () => {
    const body = buildIcs({ title: "Gig", startAt: "2026-08-18T18:30:00Z" });
    expect(body).not.toContain("DTEND");
    expect(body).not.toContain("LOCATION");
    expect(body).not.toContain("DESCRIPTION");
  });

  it("returns null for an unusable start date", () => {
    expect(buildIcs({ title: "Gig", startAt: "not-a-date" })).toBeNull();
  });
});
