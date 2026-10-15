import { describe, expect, it } from "vitest";
import { formatCountdown, formatDate, formatDateTime, formatPaise, secondsUntil } from "../src/lib/format";

const stripSpace = (s: string) => s.replace(/\s/g, "");

describe("formatPaise", () => {
  it("formats the §6 worked-example totals", () => {
    // BRD p4-p5 / API §6 example: 500/50/550/100/450/81/531 rupees.
    expect(stripSpace(formatPaise(50000))).toBe("₹500.00");
    expect(stripSpace(formatPaise(5000))).toBe("₹50.00");
    expect(stripSpace(formatPaise(55000))).toBe("₹550.00");
    expect(stripSpace(formatPaise(10000))).toBe("₹100.00");
    expect(stripSpace(formatPaise(45000))).toBe("₹450.00");
    expect(stripSpace(formatPaise(8100))).toBe("₹81.00");
    expect(stripSpace(formatPaise(53100))).toBe("₹531.00");
  });

  it("uses Indian digit grouping", () => {
    expect(stripSpace(formatPaise(10000000))).toBe("₹1,00,000.00");
  });

  it("formats zero", () => {
    expect(stripSpace(formatPaise(0))).toBe("₹0.00");
  });
});

describe("date formatting", () => {
  it("formats a date without time", () => {
    expect(formatDate("2026-08-18T18:30:00Z")).toContain("2026");
    expect(formatDate("2026-08-18T18:30:00Z")).toContain("Aug");
  });

  it("formats date and time", () => {
    expect(formatDateTime("2026-08-18T18:30:00Z")).toContain("2026");
  });

  it("passes invalid input through untouched", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("countdown helpers", () => {
  it("computes seconds until a timestamp", () => {
    const now = new Date("2026-01-01T00:00:00Z").getTime();
    expect(secondsUntil("2026-01-01T00:10:00Z", now)).toBe(600);
  });

  it("never goes negative", () => {
    const now = new Date("2026-01-01T00:00:00Z").getTime();
    expect(secondsUntil("2025-01-01T00:00:00Z", now)).toBe(0);
  });

  it("formats m:ss", () => {
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(61)).toBe("1:01");
    expect(formatCountdown(5)).toBe("0:05");
  });
});
