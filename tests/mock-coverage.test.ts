import { beforeEach, describe, expect, it } from "vitest";
import { handleMockRequestOn, type MockRequest, type MockResponse } from "../src/lib/mock/router";
import { seedStore, type MockStore } from "../src/lib/mock/store";
import type { AuthTokens } from "../src/lib/api-types";

/**
 * Contract registry: every endpoint the UI calls must resolve in the sample
 * backend. A "resolved" call returns anything except the router's own
 * no-handler 404 — domain errors (validation, auth, conflicts) still prove
 * the route exists. Fresh store per test; stateful chains set up inline.
 */
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
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body as AuthTokens;
}

/** True unless the response is the router's own "no such route" 404. */
function resolves(res: MockResponse): boolean {
  if (res.status !== 404) return true;
  const message = (res.body as { error?: { message?: string } })?.error?.message ?? "";
  return !message.startsWith("Sample backend has no ");
}

function expectResolve(res: MockResponse, label: string): void {
  expect(resolves(res), `${label} → ${JSON.stringify(res.body)}`).toBe(true);
}

let store: MockStore;
let attendee = "";
let host = "";
let staff = "";
let admin = "";
let host2 = "";

beforeEach(() => {
  store = seedStore();
  attendee = login(store, "attendee@pegwin.in").accessToken;
  host = login(store, "host@pegwin.in").accessToken;
  staff = login(store, "staff@pegwin.in").accessToken;
  admin = login(store, "admin@pegwin.in").accessToken;
  host2 = login(store, "kabir@example.com").accessToken;
});

describe("endpoint coverage: public reads", () => {
  it("serves discovery, meta, help, content and public profiles", () => {
    const paths = [
      "GET meta/categories",
      "GET meta/interests",
      "GET meta/cities",
      "GET meta/languages",
      "GET events?limit=12",
      "GET events/evt_001",
      "GET events/evt_001/agenda",
      "GET events/evt_001/attendees",
      "GET events/evt_001/tiers",
      "GET communities?page=1&limit=12",
      "GET communities/c_tech",
      "GET communities/c_tech/groups",
      "GET communities/c_tech/posts",
      "GET communities/c_tech/events?upcoming_only=true",
      "GET communities/c_tech/members?limit=12",
      "GET groups/g_tech_general/messages",
      "GET help/articles",
      "GET help/articles/help_refunds",
      "GET content/privacy-policy",
      "GET support/topics",
      "GET hosts/u_host",
      "GET users/u_attendee/public",
      "GET users/username-available?username=brandnewname",
    ];
    for (const entry of paths) {
      const [method, path] = entry.split(" ") as [MockRequest["method"], string];
      expectResolve(call(store, method, path), entry);
    }
  });
});

describe("endpoint coverage: account", () => {
  it("serves profile, prefs, inbox, saves and blocks", () => {
    expectResolve(call(store, "GET", "users/me", { token: attendee }), "GET users/me");
    expectResolve(call(store, "PATCH", "users/me", { token: attendee, body: { city: "Pune" } }), "PATCH users/me");
    expectResolve(call(store, "PATCH", "users/me/visibility", { token: attendee, body: { profileVisible: false } }), "PATCH visibility");
    expectResolve(call(store, "GET", "users/me/notification-preferences", { token: attendee }), "GET prefs");
    expectResolve(call(store, "PATCH", "users/me/notification-preferences", { token: attendee, body: { push: false } }), "PATCH prefs");
    expectResolve(call(store, "GET", "users/me/notifications", { token: attendee }), "GET notifications");
    expectResolve(call(store, "POST", "users/me/notifications/read-all", { token: attendee }), "POST read-all");
    const inbox = call(store, "GET", "users/me/notifications", { token: attendee }).body as { data: Array<{ id: string }> };
    expectResolve(call(store, "PATCH", `users/me/notifications/${inbox.data[0].id}/read`, { token: attendee }), "PATCH read");
    expectResolve(call(store, "GET", "users/me/events?filter=attended", { token: attendee }), "GET my events");
    expectResolve(call(store, "GET", "users/me/saved-events", { token: attendee }), "GET saved events");
    expectResolve(call(store, "POST", "users/me/saved-events", { token: attendee, body: { eventId: "evt_002" } }), "POST save");
    expectResolve(call(store, "DELETE", "users/me/saved-events/evt_002", { token: attendee }), "DELETE save");
    expectResolve(call(store, "GET", "users/me/saved-communities", { token: attendee }), "GET saved communities");
    expectResolve(call(store, "GET", "users/me/communities", { token: attendee }), "GET my communities");
    expectResolve(call(store, "GET", "users/me/blocked-communities", { token: attendee }), "GET blocked");
    expectResolve(call(store, "POST", "users/me/blocked-communities", { token: attendee, body: { communityId: "c_comedy" } }), "POST block");
    expectResolve(call(store, "DELETE", "users/me/blocked-communities/c_comedy", { token: attendee }), "DELETE block");
  });
});

describe("endpoint coverage: checkout ledger", () => {
  it("serves orders, tickets, payments and receipts end to end", () => {
    expectResolve(call(store, "GET", "users/me/orders", { token: attendee }), "GET orders");
    expectResolve(call(store, "GET", "users/me/tickets?status=active", { token: attendee }), "GET tickets");
    expectResolve(call(store, "GET", "users/me/payments", { token: attendee }), "GET payments");
    const hold = call(store, "POST", "checkout/holds", { token: attendee, body: { items: [{ tierId: "evt_004_t1", qty: 1 }] } });
    expectResolve(hold, "POST holds");
    const holdId = (hold.body as { holdId: string }).holdId;
    expectResolve(call(store, "GET", `checkout/holds/${holdId}`, { token: attendee }), "GET hold");
    expectResolve(call(store, "POST", "checkout/coupons/validate", { token: attendee, body: { code: "WELCOME100", tierId: "evt_004_t1", qty: 1 } }), "POST validate");
    expectResolve(call(store, "POST", "checkout/quote", { token: attendee, body: { items: [{ tierId: "evt_004_t1", qty: 1 }] } }), "POST quote");
    const order = call(store, "POST", "orders", { token: attendee, key: "cov-1", body: { holdId, attendees: [{ name: "Cover Guest" }] } });
    expectResolve(order, "POST orders");
    const orderId = (order.body as { id: string }).id;
    expectResolve(call(store, "GET", `orders/${orderId}`, { token: attendee }), "GET order");
    expectResolve(call(store, "GET", `orders/${orderId}/tickets`, { token: attendee }), "GET order tickets");
    const intent = call(store, "POST", "payments/intents", { token: attendee, body: { orderId, method: "upi" } });
    expectResolve(intent, "POST intents");
    const paymentId = (intent.body as { paymentId: string }).paymentId;
    expectResolve(call(store, "GET", `payments/${paymentId}`, { token: attendee }), "GET payment");
    expectResolve(call(store, "GET", `payments/${paymentId}/refunds`, { token: attendee }), "GET refunds");
    expectResolve(call(store, "GET", `orders/${orderId}/receipt`, { token: attendee }), "GET receipt");
    const tickets = call(store, "GET", `orders/${orderId}/tickets`, { token: attendee }).body as Array<{ ticketCode: string }>;
    expectResolve(call(store, "GET", `tickets/${tickets[0].ticketCode}`, { token: attendee }), "GET ticket");
    expectResolve(call(store, "POST", `orders/${orderId}/cancel`, { token: attendee, body: {} }), "POST cancel");
    const holdB = call(store, "POST", "checkout/holds", { token: attendee, body: { items: [{ tierId: "evt_004_t1", qty: 1 }] } });
    expectResolve(call(store, "DELETE", `checkout/holds/${(holdB.body as { holdId: string }).holdId}`, { token: attendee }), "DELETE hold");
  });
});

describe("endpoint coverage: social", () => {
  it("serves community manage, chat, posts and reports", () => {
    expectResolve(call(store, "POST", "communities", { token: host, body: { name: "Cover Club", category: "Tech" } }), "POST communities");
    expectResolve(call(store, "PATCH", "communities/c_music", { token: host, body: { description: "Updated" } }), "PATCH community");
    expectResolve(call(store, "POST", "communities/c_music/groups", { token: host, body: { name: "Logistics" } }), "POST group");
    expectResolve(call(store, "GET", "communities/c_tech/join-requests?status=pending", { token: host }), "GET join requests");
    expectResolve(call(store, "GET", "communities/c_tech/reports", { token: host }), "GET reports");
    const reports = call(store, "GET", "communities/c_tech/reports", { token: host }).body as Array<{ id: string }>;
    expectResolve(call(store, "GET", `communities/c_tech/reports/${reports[0].id}`, { token: host }), "GET report");
    expectResolve(call(store, "POST", `communities/c_tech/reports/${reports[0].id}/actions`, { token: host, body: { action: "dismiss" } }), "POST report action");
    expectResolve(call(store, "GET", "communities/c_food/blocked", { token: host2 }), "GET blocked");
    expectResolve(call(store, "POST", "communities/c_music/blocked", { token: host, body: { userId: "u_m4" } }), "POST block member");
    expectResolve(call(store, "DELETE", "communities/c_music/blocked/u_m4", { token: host }), "DELETE block member");
    expectResolve(call(store, "GET", "communities/c_tech/team", { token: host }), "GET team");
    expectResolve(call(store, "POST", "communities/c_tech/team", { token: host, body: { userId: "u_m2", role: "moderator" } }), "POST team");
    expectResolve(call(store, "DELETE", "communities/c_tech/team/u_m2", { token: host }), "DELETE team");
    expectResolve(call(store, "GET", "communities/c_tech/data-summary", { token: host }), "GET data summary");
    expectResolve(call(store, "GET", "communities/c_tech/exports", { token: host }), "GET exports");
    expectResolve(call(store, "POST", "communities/c_tech/exports", { token: host, body: { type: "members" } }), "POST export");
    expectResolve(call(store, "POST", "communities/c_tech/mute", { token: attendee }), "POST mute");
    expectResolve(call(store, "DELETE", "communities/c_tech/mute", { token: attendee }), "DELETE mute");
    expectResolve(call(store, "POST", "groups/g_music_general/join", { token: staff }), "POST join");
    expectResolve(call(store, "POST", "groups/g_music_general/leave", { token: staff }), "POST leave");
    expectResolve(call(store, "GET", "groups/g_music_general/members", { token: attendee }), "GET group members");
    const sent = call(store, "POST", "groups/g_music_general/messages", { token: attendee, body: { text: "Cover hello" } });
    expectResolve(sent, "POST message");
    expectResolve(call(store, "DELETE", `groups/g_music_general/messages/${(sent.body as { id: string }).id}`, { token: host }), "DELETE message");
    expectResolve(call(store, "POST", "reports", { token: attendee, body: { communityId: "c_tech", reason: "Cover spam" } }), "POST report");
    expectResolve(call(store, "POST", "uploads", { token: attendee, body: { contentType: "image/png" } }), "POST uploads");
    const postId = store.posts["c_tech"][0].id;
    expectResolve(call(store, "POST", `posts/${postId}/likes`, { token: attendee }), "POST like");
    expectResolve(call(store, "DELETE", `posts/${postId}/likes`, { token: attendee }), "DELETE like");
    expectResolve(call(store, "GET", `posts/${postId}/comments`, { token: attendee }), "GET comments");
    expectResolve(call(store, "POST", `posts/${postId}/comments`, { token: attendee, body: { text: "Cover comment" } }), "POST comment");
    expectResolve(call(store, "POST", "communities/c_music/posts", { token: attendee, body: { text: "Cover post" } }), "POST community post");
    expectResolve(call(store, "DELETE", "groups/g_music_general/members/u_m2", { token: host }), "DELETE group member");
    expectResolve(call(store, "POST", "communities/c_music/transfer-ownership", { token: host, body: { userId: "u_m2" } }), "POST transfer");
    const created = call(store, "POST", "communities", { token: host, body: { name: "Delete Me" } }).body as { id: string };
    expectResolve(call(store, "DELETE", `communities/${created.id}?confirm=true`, { token: host }), "DELETE community");
  });
});

describe("endpoint coverage: host", () => {
  it("serves host console, events, tiers, team and scanner", () => {
    for (const path of [
      "hosts/me/events?limit=5",
      "hosts/me/analytics/overview",
      "hosts/me/analytics/top-events",
      "hosts/me/invoices",
      "hosts/me/payout-schedule",
      "hosts/me/payouts",
      "hosts/me/transactions?limit=5",
      "hosts/me/payout-accounts",
      "hosts/me/tax-info",
      "hosts/me/verification",
    ]) {
      expectResolve(call(store, "GET", path, { token: host }), `GET ${path}`);
    }
    const invoices = call(store, "GET", "hosts/me/invoices", { token: host }).body as Array<{ id: string }>;
    expectResolve(call(store, "GET", `hosts/me/invoices/${invoices[0].id}`, { token: host }), "GET invoice");
    const account = call(store, "POST", "hosts/me/payout-accounts", { token: host, body: { bankName: "SBI", accountNumber: "123456789012", holder: "Meera Nair" } });
    expectResolve(account, "POST payout account");
    const accountId = (account.body as { id: string }).id;
    expectResolve(call(store, "PATCH", `hosts/me/payout-accounts/${accountId}`, { token: host, body: { holder: "M. Nair" } }), "PATCH payout account");
    expectResolve(call(store, "POST", `hosts/me/payout-accounts/${accountId}/disconnect`, { token: host }), "POST disconnect");
    expectResolve(call(store, "POST", "hosts/me/payout-requests", { token: host, body: { eventId: "evt_004" } }), "POST payout request");
    const created = call(store, "POST", "events", { token: host, body: { title: "Cover Live", description: "d", startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString() } });
    expectResolve(created, "POST events");
    const id = (created.body as { id: string }).id;
    expectResolve(call(store, "PATCH", `events/${id}`, { token: host, body: { venue: "Cover Hall" } }), "PATCH event");
    expectResolve(call(store, "POST", `events/${id}/agenda`, { token: host, body: { slots: [{ time: "7 PM", title: "Doors" }] } }), "POST agenda");
    expectResolve(call(store, "POST", `events/${id}/submit-review`, { token: host }), "POST submit");
    expectResolve(call(store, "POST", `events/${id}/reschedule`, { token: host, body: { startAt: new Date(Date.now() + 172800000).toISOString() } }), "POST reschedule");
    expectResolve(call(store, "GET", `events/${id}/team`, { token: host }), "GET team");
    expectResolve(call(store, "POST", `events/${id}/team`, { token: host, body: { email: "staff@pegwin.in", permissions: ["scan_tickets"] } }), "POST team");
    expectResolve(call(store, "PATCH", `events/${id}/team/u_staff`, { token: host, body: { permissions: ["manage_event"] } }), "PATCH team");
    expectResolve(call(store, "GET", `events/${id}/checkins`, { token: host }), "GET checkins");
    expectResolve(call(store, "GET", `events/${id}/analytics`, { token: host }), "GET event analytics");
    expectResolve(call(store, "POST", `events/${id}/rehost`, { token: host }), "POST rehost");
    expectResolve(call(store, "POST", `events/${id}/cancel`, { token: host, body: { reason: "Cover cancel" } }), "POST cancel");
    expectResolve(call(store, "POST", "events/evt_001/ratings", { token: attendee, body: { rating: 5 } }), "POST rating");
    const tier = call(store, "POST", "events/evt_001/tiers", { token: host, body: { name: "Cover Tier", price: 10000, capacity: 10 } });
    expectResolve(tier, "POST tier");
    const tierId = (tier.body as { id: string }).id;
    expectResolve(call(store, "PATCH", `tiers/${tierId}`, { token: host, body: { capacity: 20 } }), "PATCH tier");
    expectResolve(call(store, "DELETE", `tiers/${tierId}`, { token: host }), "DELETE tier");
    expectResolve(call(store, "DELETE", `events/${id}/team/u_staff`, { token: host }), "DELETE team");
    expectResolve(call(store, "GET", "events/evt_002/validation-data", { token: staff }), "GET validation data");
    expectResolve(call(store, "POST", "checkins", { token: staff, body: { ticketCode: "PGW000000001" } }), "POST checkin");
    expectResolve(call(store, "POST", "checkins/sync", { token: staff, body: { scans: [] } }), "POST sync");
  });
});

describe("endpoint coverage: admin", () => {
  it("serves review, enforcement, reports, coupons, payouts and audit", () => {
    expectResolve(call(store, "GET", "admin/events/review-queue", { token: admin }), "GET queue");
    expectResolve(call(store, "POST", "admin/events/evt_007/approve", { token: admin, body: {} }), "POST approve");
    expectResolve(call(store, "POST", "admin/events/evt_015/reject", { token: admin, body: { reason: "Cover reject" } }), "POST reject");
    expectResolve(call(store, "POST", "admin/events/evt_001/suspend", { token: admin, body: { reason: "Cover suspend" } }), "POST suspend");
    expectResolve(call(store, "POST", "admin/events/evt_005/remove", { token: admin, body: { reason: "Cover remove" } }), "POST remove");
    expectResolve(call(store, "GET", "admin/hosts/flagged", { token: admin }), "GET flagged");
    expectResolve(call(store, "POST", "admin/hosts/u_host3/warn", { token: admin, body: { reason: "Cover warn" } }), "POST warn");
    expectResolve(call(store, "POST", "admin/hosts/u_host3/suspend", { token: admin, body: { reason: "Cover suspend" } }), "POST host suspend");
    expectResolve(call(store, "POST", "admin/hosts/u_host3/verification", { token: admin, body: { identity: "verified", payoutAccount: "verified" } }), "POST verification");
    expectResolve(call(store, "POST", "admin/hosts/u_host3/remove", { token: admin, body: { reason: "Cover remove" } }), "POST host remove");
    expectResolve(call(store, "GET", "admin/reports?status=open", { token: admin }), "GET admin reports");
    const reports = call(store, "GET", "admin/reports", { token: admin }).body as { data: Array<{ id: string }> };
    expectResolve(call(store, "PATCH", `admin/reports/${reports.data[0].id}`, { token: admin, body: { status: "dismissed" } }), "PATCH report");
    expectResolve(call(store, "GET", "admin/coupons", { token: admin }), "GET coupons");
    const coupon = call(store, "POST", "admin/coupons", { token: admin, body: { code: "COVER50", discountType: "flat", value: 5000 } });
    expectResolve(coupon, "POST coupon");
    expectResolve(call(store, "PATCH", `admin/coupons/${(coupon.body as { id: string }).id}`, { token: admin, body: { enabled: false } }), "PATCH coupon");
    expectResolve(call(store, "GET", "admin/payouts", { token: admin }), "GET payouts");
    const payouts = call(store, "GET", "admin/payouts", { token: admin }).body as { data: Array<{ id: string }> };
    expectResolve(call(store, "POST", "admin/payouts", { token: admin, body: { payoutId: payouts.data[0].id } }), "POST payout");
    expectResolve(call(store, "PATCH", `admin/payouts/${payouts.data[0].id}`, { token: admin, body: { status: "processing" } }), "PATCH payout");
    expectResolve(call(store, "GET", "admin/audit-logs", { token: admin }), "GET audit");
    expectResolve(call(store, "GET", "admin/overview", { token: admin }), "GET overview");
    expectResolve(call(store, "GET", "admin/events?status=review", { token: admin }), "GET admin events");
    expectResolve(call(store, "GET", "admin/events/evt_002/attendees", { token: admin }), "GET attendees");
    expectResolve(call(store, "GET", "admin/events/evt_002/team", { token: admin }), "GET admin team");
    expectResolve(call(store, "GET", "admin/hosts?search=kabir", { token: admin }), "GET admin hosts");
  });
});

describe("endpoint coverage: support", () => {
  it("serves topics, conversations and threads", () => {
    expectResolve(call(store, "GET", "support/topics", { token: attendee }), "GET topics");
    expectResolve(call(store, "GET", "support/conversations", { token: attendee }), "GET convos");
    const convo = call(store, "POST", "support/conversations", { token: attendee, body: { topic: "Events", message: "Cover question" } });
    expectResolve(convo, "POST convo");
    const id = (convo.body as { id: string }).id;
    expectResolve(call(store, "GET", `support/conversations/${id}/messages`, { token: attendee }), "GET messages");
    expectResolve(call(store, "POST", `support/conversations/${id}/messages`, { token: attendee, body: { text: "Cover follow-up" } }), "POST message");
  });
});
