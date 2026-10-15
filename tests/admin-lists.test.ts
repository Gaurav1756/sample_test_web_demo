import { describe, expect, it } from "vitest";
import { splitEventTeam, teamMemberKey, teamMemberName } from "../src/lib/admin-team";
import {
  countEventsByStatus,
  countPayoutsByStatus,
  countRecordByStatus,
  topEventsBySales,
} from "../src/lib/admin-analytics";
import type { Payout, TeamMember } from "../src/lib/api-types";

describe("splitEventTeam", () => {
  it("treats manage_event members as hosts and the rest as staff", () => {
    const team: TeamMember[] = [
      { userId: "u1", user: { id: "u1", name: "Asha", username: "asha" }, permissions: ["manage_event"] },
      { userId: "u2", user: { id: "u2", name: "Dev", username: "dev" }, permissions: ["scan_tickets"] },
      { userId: "u3", user: { id: "u3", name: "NoPerms", username: "noperms" } },
    ];
    const { hosts, staff } = splitEventTeam(team);
    expect(hosts.map((m) => m.userId)).toEqual(["u1"]);
    expect(staff.map((m) => m.userId)).toEqual(["u2", "u3"]);
  });

  it("keeps multi-permission hosts out of the staff list", () => {
    const team: TeamMember[] = [
      {
        userId: "u1",
        user: { id: "u1", name: "Sam", username: "sam" },
        permissions: ["manage_event", "scan_tickets"],
      },
    ];
    const { hosts, staff } = splitEventTeam(team);
    expect(hosts).toHaveLength(1);
    expect(staff).toHaveLength(0);
  });

  it("resolves display names and keys without throwing", () => {
    expect(teamMemberName({ permissions: [] }, "fallback")).toBe("fallback");
    expect(
      teamMemberName(
        { user: { id: "u9", name: "Zoe", username: "zoe" }, permissions: [] },
        "fallback",
      ),
    ).toBe("Zoe");
    expect(teamMemberKey({ userId: "u1" }, 0)).toBe("u1");
    expect(teamMemberKey({}, 4)).toBe("member-4");
  });
});

describe("admin analytics derivations", () => {
  it("counts events by status, most-common first", () => {
    expect(
      countEventsByStatus([
        { status: "live" },
        { status: "completed" },
        { status: "live" },
      ]),
    ).toEqual([
      { status: "live", count: 2 },
      { status: "completed", count: 1 },
    ]);
  });

  it("counts a by-status record into sorted rows", () => {
    expect(countRecordByStatus({ live: 3, draft: 1, cancelled: 2 })).toEqual([
      { status: "live", count: 3 },
      { status: "cancelled", count: 2 },
      { status: "draft", count: 1 },
    ]);
  });

  it("ranks top events by tickets sold without mutating the input", () => {
    const events = [
      { id: "a", soldCount: 5 },
      { id: "b", soldCount: 40 },
      { id: "c", soldCount: 20 },
    ];
    expect(topEventsBySales(events, 2).map((e) => e.id)).toEqual(["b", "c"]);
    expect(events[0]?.id).toBe("a");
  });

  it("counts payouts by status", () => {
    const payouts = [
      { status: "paid" },
      { status: "pending" },
      { status: "paid" },
    ] as Payout[];
    expect(countPayoutsByStatus(payouts)).toEqual([
      { status: "paid", count: 2 },
      { status: "pending", count: 1 },
    ]);
  });
});
