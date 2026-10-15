import { describe, expect, it } from "vitest";
import { handleMockRequestOn, type MockRequest, type MockResponse } from "../src/lib/mock/router";
import { seedStore, type MockStore } from "../src/lib/mock/store";
import type { AuthTokens, Community, EventDetail, GroupMessage, Page } from "../src/lib/api-types";

function call(
  store: MockStore,
  method: MockRequest["method"],
  path: string,
  opts: { body?: unknown; token?: string; key?: string } = {},
): MockResponse {
  const [p, qs] = path.split("?");
  const query: Record<string, string> = {};
  if (qs) {
    for (const part of qs.split("&")) {
      const [k, v] = part.split("=");
      if (k && !(k in query)) query[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  }
  return handleMockRequestOn(store, {
    method,
    segments: p.split("/").filter(Boolean),
    query,
    authToken: opts.token,
    body: opts.body,
    idempotencyKey: opts.key,
  });
}

function login(store: MockStore, email: string): AuthTokens {
  const res = call(store, "POST", "auth/login", { body: { email, password: "demo1234" } });
  expect(res.status).toBe(200);
  return res.body as AuthTokens;
}

describe("mock communities and chat", () => {
  it("lists communities with search and per-user enrichment", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const res = call(store, "GET", "communities?limit=10", { token }).body as Page<Community>;
    expect(res.total).toBeGreaterThanOrEqual(4);
    const tech = res.data.find((c) => c.id === "c_tech");
    expect(tech?.membershipState).toBe("member");
    expect(tech?.stats?.members).toBeGreaterThan(0);
    const searched = call(store, "GET", "communities?search=comedy", { token }).body as Page<Community>;
    expect(searched.data.every((c) => `${c.name}${c.description}`.toLowerCase().includes("comedy"))).toBe(true);
  });

  it("joins open groups with the exact BRD warning text", () => {
    const store = seedStore();
    const newcomer = login(store, "sneha@example.com");
    const res = call(store, "POST", "groups/g_music_general/join", { token: newcomer.accessToken });
    expect(res.status).toBe(200);
    expect((res.body as { communityWarning: string }).communityWarning).toBe(
      "Please do not use abusive, offensive, or inappropriate language. Respect all community members.",
    );
  });

  it("holds approval-only joins for host review", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const res = call(store, "POST", "groups/g_comedy_general/join", { token });
    expect(res.status).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe("JOIN_REQUIRES_APPROVAL");
    const host = login(store, "kabir@example.com");
    const requests = call(store, "GET", "communities/c_comedy/join-requests", { token: host.accessToken }).body as Array<{ user: { id: string } }>;
    expect(requests.some((r) => r.user.id === "u_attendee")).toBe(true);
  });

  it("enforces text-only chat for members (BR-013) but lets hosts post media", () => {
    const store = seedStore();
    const member = login(store, "attendee@pegwin.in");
    const text = call(store, "POST", "groups/g_tech_general/messages", { token: member.accessToken, body: { text: "Hello all" } });
    expect(text.status).toBe(201);
    const media = call(store, "POST", "groups/g_tech_general/messages", {
      token: member.accessToken,
      body: { type: "image", text: "pic", mediaUrl: "/x.png" },
    });
    expect(media.status).toBe(403);
    expect((media.body as { error: { code: string } }).error.code).toBe("MEDIA_NOT_ALLOWED_FOR_MEMBERS");
    const host = login(store, "host@pegwin.in");
    const announcement = call(store, "POST", "groups/g_tech_general/messages", {
      token: host.accessToken,
      body: { type: "announcement", text: "Doors open early" },
    });
    expect(announcement.status).toBe(201);
    const feed = call(store, "GET", "groups/g_tech_general/messages", { token: member.accessToken }).body as { data: GroupMessage[] };
    expect(feed.data.some((m) => m.text === "Hello all")).toBe(true);
  });

  it("supports post likes and comments", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const postId = store.posts["c_tech"][0].id;
    const base = store.posts["c_tech"][0].likesCount;
    call(store, "POST", `posts/${postId}/likes`, { token });
    expect(store.posts["c_tech"][0].likesCount).toBe(base + 1);
    const comment = call(store, "POST", `posts/${postId}/comments`, { token, body: { text: "Nice!" } });
    expect(comment.status).toBe(201);
    const list = call(store, "GET", `posts/${postId}/comments`, { token }).body as { data: Array<{ text: string }> };
    expect(list.data.some((c) => c.text === "Nice!")).toBe(true);
  });

  it("routes member reports into the host and admin queues", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const created = call(store, "POST", "reports", { token, body: { communityId: "c_music", targetType: "message", reason: "Spam link" } });
    expect(created.status).toBe(201);
    const admin = login(store, "admin@pegwin.in");
    const queue = call(store, "GET", "admin/reports?status=open", { token: admin.accessToken }).body as Page<{ id: string }>;
    expect(queue.data.some((r) => r.id === (created.body as { id: string }).id)).toBe(true);
  });
});

describe("mock host event lifecycle", () => {
  it("runs draft → submit → approve → published across host and admin", () => {
    const store = seedStore();
    const host = login(store, "host@pegwin.in");
    const created = call(store, "POST", "events", {
      token: host.accessToken,
      body: { title: "Test Gathering", description: "A test event", category: "Tech", startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString() },
    });
    expect(created.status).toBe(201);
    const id = (created.body as EventDetail).id;
    const submitted = call(store, "POST", `events/${id}/submit-review`, { token: host.accessToken });
    expect((submitted.body as EventDetail).status).toBe("review");
    const admin = login(store, "admin@pegwin.in");
    const queue = call(store, "GET", "admin/events/review-queue", { token: admin.accessToken }).body as Page<EventDetail>;
    expect(queue.data.some((e) => e.id === id)).toBe(true);
    const approved = call(store, "POST", `admin/events/${id}/approve`, { token: admin.accessToken, body: {} });
    expect((approved.body as EventDetail).status).toBe("published");
    expect(store.auditLog.some((a) => a.action === "event.approved" && a.entityId === id)).toBe(true);
  });

  it("rejects events back to draft and records the decision", () => {
    const store = seedStore();
    const admin = login(store, "admin@pegwin.in");
    const rejected = call(store, "POST", "admin/events/evt_007/reject", { token: admin.accessToken, body: { reason: "Needs a venue" } });
    expect((rejected.body as EventDetail).status).toBe("draft");
  });

  it("lists flagged hosts and enforces warn/suspend", () => {
    const store = seedStore();
    const admin = login(store, "admin@pegwin.in");
    const flagged = call(store, "GET", "admin/hosts/flagged", { token: admin.accessToken }).body as Array<{ hostId: string; cancelledEvents: number }>;
    expect(flagged.some((h) => h.hostId === "u_host2" && h.cancelledEvents >= 3)).toBe(true);
    const warned = call(store, "POST", "admin/hosts/u_host2/warn", { token: admin.accessToken, body: { reason: "Too many cancellations" } });
    expect(warned.status).toBe(200);
    expect(store.auditLog.some((a) => a.action === "host.warn" && a.entityId === "u_host2")).toBe(true);
  });

  it("serves host finance reads and payout requests", () => {
    const store = seedStore();
    const host = login(store, "host@pegwin.in");
    const schedule = call(store, "GET", "hosts/me/payout-schedule", { token: host.accessToken });
    expect(schedule.status).toBe(200);
    const before = (call(store, "GET", "hosts/me/payouts", { token: host.accessToken }).body as unknown[]).length;
    const requested = call(store, "POST", "hosts/me/payout-requests", { token: host.accessToken, body: { eventId: "evt_001" } });
    expect(requested.status).toBe(201);
    const after = (call(store, "GET", "hosts/me/payouts", { token: host.accessToken }).body as unknown[]).length;
    expect(after).toBe(before + 1);
  });
});

describe("mock role enforcement", () => {
  it("blocks attendees from host and admin actions", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    expect(call(store, "GET", "admin/events/review-queue", { token }).status).toBe(403);
    expect(call(store, "POST", "events", { token, body: { title: "x" } }).status).toBe(403);
    expect(call(store, "GET", "hosts/me/payouts", { token }).status).toBe(403);
  });

  it("blocks hosts from admin actions", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "host@pegwin.in");
    expect(call(store, "GET", "admin/hosts/flagged", { token }).status).toBe(403);
    expect(call(store, "POST", "admin/events/evt_007/approve", { token, body: {} }).status).toBe(403);
  });

  it("aggregates per-event attendees for admin oversight", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "admin@pegwin.in");
    const rows = call(store, "GET", "admin/events/evt_002/attendees", { token }).body as Array<{
      user: { id: string };
      orders: number;
      tickets: number;
      checkedIn: number;
      spentPaise: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].user.id).toBe("u_attendee");
    expect(rows[0].orders).toBe(1);
    expect(rows[0].tickets).toBe(2);
    expect(rows[0].checkedIn).toBe(1);
    expect(rows[0].spentPaise).toBe(77620);
  });

  it("reports platform overview totals", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "admin@pegwin.in");
    const overview = call(store, "GET", "admin/overview", { token }).body as {
      users: { total: number; byRole: Record<string, number> };
      events: { total: number; byStatus: Record<string, number> };
      tickets: { sold: number; checkedIn: number };
      revenuePaise: number;
    };
    expect(overview.users.byRole.host).toBe(3);
    expect(overview.events.total).toBe(19);
    expect(overview.events.byStatus.review).toBe(2);
    expect(overview.tickets.sold).toBe(2);
    expect(overview.tickets.checkedIn).toBe(1);
    expect(overview.revenuePaise).toBe(77620);
  });

  it("lists all hosts with counts", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "admin@pegwin.in");
    const hosts = call(store, "GET", "admin/hosts", { token }).body as Array<{
      hostId: string;
      eventsHosted: number;
      status: string;
    }>;
    expect(hosts.map((h) => h.hostId).sort()).toEqual(["u_host", "u_host2", "u_host3"]);
    expect(hosts.find((h) => h.hostId === "u_host2")?.status).toBe("flagged");
    expect(hosts.find((h) => h.hostId === "u_host")?.status).toBe("active");
  });

  it("scopes staff event lists to team assignments (BR-016)", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "staff@pegwin.in");
    const res = call(store, "GET", "hosts/me/events?status=live", { token }).body as Page<EventDetail>;
    expect(res.data.map((e) => e.id)).toEqual(["evt_002"]);
    expect(call(store, "GET", "hosts/me/payouts", { token }).status).toBe(403);
    expect(call(store, "GET", "hosts/me/transactions", { token }).status).toBe(403);
  });

  it("marks notifications read individually and in bulk", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const inbox = call(store, "GET", "users/me/notifications", { token }).body as Page<{ id: string; readAt: string | null }>;
    const unread = inbox.data.find((n) => !n.readAt);
    expect(unread).toBeDefined();
    call(store, "PATCH", `users/me/notifications/${unread!.id}/read`, { token });
    const reread = call(store, "GET", "users/me/notifications", { token }).body as Page<{ id: string; readAt: string | null }>;
    expect(reread.data.find((n) => n.id === unread!.id)?.readAt).toBeTruthy();
    call(store, "POST", "users/me/notifications/read-all", { token });
    const all = call(store, "GET", "users/me/notifications", { token }).body as Page<{ readAt: string | null }>;
    expect(all.data.every((n) => n.readAt)).toBe(true);
  });
});
