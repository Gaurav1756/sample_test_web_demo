import { describe, expect, it } from "vitest";
import { handleMockRequestOn, type MockRequest, type MockResponse } from "../src/lib/mock/router";
import { seedStore, type MockStore } from "../src/lib/mock/store";
import type { AuthTokens, EventDetail, Hold, Order, Page, Payment, PaymentIntent, Quote, Tier } from "../src/lib/api-types";

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

/** Full purchase: hold → quote → order → simulated pay. Returns the order. */
function purchase(store: MockStore, token: string, tierId: string, qty: number, couponCode?: string): Order {
  const hold = call(store, "POST", "checkout/holds", { token, body: { items: [{ tierId, qty }] } });
  expect(hold.status).toBe(201);
  const order = call(
    store,
    "POST",
    "orders",
    {
      token,
      key: `order-${tierId}-${qty}-${Date.now()}`,
      body: {
        holdId: (hold.body as Hold).holdId,
        attendees: Array.from({ length: qty }, (_, i) => ({ name: `Guest ${i + 1}` })),
        ...(couponCode ? { couponCode } : {}),
      },
    },
  );
  expect(order.status).toBe(201);
  const intent = call(store, "POST", "payments/intents", { token, body: { orderId: (order.body as Order).id, method: "upi" } });
  expect(intent.status).toBe(201);
  const payment = call(store, "GET", `payments/${(intent.body as PaymentIntent).paymentId}`, { token });
  expect((payment.body as Payment).status).toBe("success");
  const fetched = call(store, "GET", `orders/${(order.body as Order).id}`, { token });
  expect((fetched.body as Order).status).toBe("confirmed");
  return fetched.body as Order;
}

describe("mock events discovery", () => {
  it("lists only public events with page envelopes", () => {
    const store = seedStore();
    const res = call(store, "GET", "events?limit=50");
    expect(res.status).toBe(200);
    const page = res.body as Page<EventDetail>;
    expect(page.total).toBeGreaterThan(5);
    expect(page.data.every((e) => ["published", "on_sale", "live", "rescheduled"].includes(e.status))).toBe(true);
  });

  it("filters by category, city, pricing model, dates, price and search", () => {
    const store = seedStore();
    const music = call(store, "GET", "events?category=Music&limit=50").body as Page<EventDetail>;
    expect(music.data.length).toBeGreaterThan(0);
    expect(music.data.every((e) => e.category === "Music")).toBe(true);
    const free = call(store, "GET", "events?pricingModel=free&limit=50").body as Page<EventDetail>;
    expect(free.data.length).toBeGreaterThan(0);
    expect(free.data.every((e) => e.minPrice === 0)).toBe(true);
    const city = call(store, "GET", "events?city=Mumbai&limit=50").body as Page<EventDetail>;
    expect(city.data.every((e) => e.city === "Mumbai")).toBe(true);
    const search = call(store, "GET", "events?search=comedy&limit=50").body as Page<EventDetail>;
    expect(search.data.length).toBeGreaterThan(0);
    const priced = call(store, "GET", "events?priceMin=50000&limit=50").body as Page<EventDetail>;
    expect(priced.data.every((e) => e.minPrice >= 50000)).toBe(true);
    const p1 = call(store, "GET", "events?page=1&limit=3").body as Page<EventDetail>;
    const p2 = call(store, "GET", "events?page=2&limit=3").body as Page<EventDetail>;
    expect(p1.data).toHaveLength(3);
    expect(p2.page).toBe(2);
    expect(p1.data[0].id).not.toBe(p2.data[0].id);
  });

  it("hides drafts from the public but shows them to the owner", () => {
    const store = seedStore();
    expect(call(store, "GET", "events/evt_006").status).toBe(404);
    const host = login(store, "host@pegwin.in");
    const mine = call(store, "GET", "events/evt_006", { token: host.accessToken });
    expect(mine.status).toBe(200);
    expect((mine.body as EventDetail).status).toBe("draft");
  });

  it("serves agenda, attendees and live tiers", () => {
    const store = seedStore();
    const agenda = call(store, "GET", "events/evt_001/agenda").body as { slots: unknown[] };
    expect(agenda.slots.length).toBeGreaterThan(0);
    const tiers = call(store, "GET", "events/evt_001/tiers").body as Tier[];
    expect(tiers.every((t) => t.availableCount === t.capacity - t.soldCount)).toBe(true);
  });
});

describe("mock checkout flow", () => {
  it("quotes with the BRD chain and applies flat coupons", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_001/tiers", { token }).body as Tier[];
    const tier = tiers[0];
    const quote = call(store, "POST", "checkout/quote", {
      token,
      body: { items: [{ tierId: tier.id, qty: 1 }], couponCode: "WELCOME100" },
    }).body as Quote;
    expect(quote.totals.discount).toBe(10000);
    expect(quote.totals.taxableAmount).toBe(quote.totals.displayPrice - 10000);
    expect(quote.totals.finalPayable).toBe(quote.totals.taxableAmount + quote.totals.gst);
  });

  it("rejects unknown and expired coupons", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_001/tiers", { token }).body as Tier[];
    for (const code of ["NOPE", "OLDDEAL"]) {
      const res = call(store, "POST", "checkout/coupons/validate", {
        token,
        body: { code, tierId: tiers[0].id, qty: 1 },
      }).body as { valid: boolean };
      expect(res.valid).toBe(false);
    }
  });

  it("completes hold → order → pay → tickets → bookings", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_004/tiers", { token }).body as Tier[];
    const order = purchase(store, token, tiers[0].id, 2, "FESTIVE20");
    expect(order.amounts.discount).toBeGreaterThan(0);
    const tickets = call(store, "GET", "users/me/tickets?status=active", { token }).body as Array<{ ticketCode: string }>;
    const mine = (call(store, "GET", `orders/${order.id}/tickets`, { token }).body as Array<{ ticketCode: string }>);
    expect(mine).toHaveLength(2);
    expect(mine[0].ticketCode).toMatch(/^[A-Z0-9]{12}$/);
    expect(tickets.some((t) => t.ticketCode === mine[0].ticketCode)).toBe(true);
    const orders = call(store, "GET", "users/me/orders", { token }).body as Order[];
    expect(orders.some((o) => o.id === order.id && o.status === "confirmed")).toBe(true);
  });

  it("expires holds and refuses orders against them", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_001/tiers", { token }).body as Tier[];
    const hold = call(store, "POST", "checkout/holds", { token, body: { items: [{ tierId: tiers[0].id, qty: 1 }] } });
    const holdId = (hold.body as Hold).holdId;
    const rec = store.holds.find((h) => h.holdId === holdId);
    expect(rec).toBeDefined();
    rec!.expiresAt = new Date(Date.now() - 1000).toISOString();
    const order = call(store, "POST", "orders", { token, body: { holdId, attendees: [{ name: "Late Guest" }] } });
    expect(order.status).toBe(404);
    expect((order.body as { error: { code: string } }).error.code).toBe("HOLD_EXPIRED");
  });

  it("dedupes orders by idempotency key", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_001/tiers", { token }).body as Tier[];
    const hold = call(store, "POST", "checkout/holds", { token, body: { items: [{ tierId: tiers[0].id, qty: 1 }] } });
    const holdId = (hold.body as Hold).holdId;
    const payload = { holdId, attendees: [{ name: "Retry Guest" }] };
    const first = call(store, "POST", "orders", { token, body: payload, key: "idem-1" });
    const second = call(store, "POST", "orders", { token, body: payload, key: "idem-1" });
    expect(first.status).toBe(201);
    expect((second.body as Order).id).toBe((first.body as Order).id);
    expect(store.orders).toHaveLength(2); // 1 seeded + 1 created
  });

  it("refuses holds beyond live inventory", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    // Front Row has 6 left; asking 10 (within the per-order cap) must 409.
    const res = call(store, "POST", "checkout/holds", {
      token,
      body: { items: [{ tierId: "evt_002_t2", qty: 10 }] },
    });
    expect(res.status).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe("INSUFFICIENT_INVENTORY");
  });

  it("cancels confirmed orders with a refund record", () => {
    const store = seedStore();
    const { accessToken: token } = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_004/tiers", { token }).body as Tier[];
    const order = purchase(store, token, tiers[0].id, 1);
    const cancelled = call(store, "POST", `orders/${order.id}/cancel`, { token });
    expect(cancelled.status).toBe(200);
    expect((cancelled.body as { status: string }).status).toBe("cancelled");
    expect((cancelled.body as { refundAmount: number }).refundAmount).toBe(order.amounts.finalPayable);
    const fetched = call(store, "GET", `orders/${order.id}`, { token }).body as Order;
    expect(fetched.status).toBe("cancelled");
  });
});

describe("mock ticket check-in", () => {
  it("checks in once and rejects the second scan (BR-011)", () => {
    const store = seedStore();
    const host = login(store, "host@pegwin.in");
    const attendee = login(store, "attendee@pegwin.in");
    const tiers = call(store, "GET", "events/evt_002/tiers", { token: attendee.accessToken }).body as Tier[];
    const order = purchase(store, attendee.accessToken, tiers[0].id, 1);
    const tickets = call(store, "GET", `orders/${order.id}/tickets`, { token: attendee.accessToken }).body as Array<{ ticketCode: string }>;
    const code = tickets[0].ticketCode;
    const first = call(store, "POST", "checkins", { token: host.accessToken, body: { ticketCode: code, scannedAt: new Date().toISOString() } });
    expect(first.status).toBe(200);
    const second = call(store, "POST", "checkins", { token: host.accessToken, body: { ticketCode: code, scannedAt: new Date().toISOString() } });
    expect(second.status).toBe(409);
    expect((second.body as { error: { code: string } }).error.code).toBe("ALREADY_CHECKED_IN");
  });

  it("lets assigned event staff scan but rejects unknown codes", () => {
    const store = seedStore();
    const staff = login(store, "staff@pegwin.in");
    const unknown = call(store, "POST", "checkins", { token: staff.accessToken, body: { ticketCode: "PGWZZZZZZZZZ" } });
    expect(unknown.status).toBe(404);
    const confirmed = Object.values(store.ticketsByCode).find((t) => t.eventId === "evt_002" && t.status === "confirmed");
    expect(confirmed).toBeDefined();
    const res = call(store, "POST", "checkins", { token: staff.accessToken, body: { ticketCode: confirmed!.ticketCode } });
    expect(res.status).toBe(200);
  });

  it("syncs offline batches first-wins", () => {
    const store = seedStore();
    const host = login(store, "host@pegwin.in");
    const confirmed = Object.values(store.ticketsByCode).find((t) => t.eventId === "evt_002" && t.status === "confirmed");
    expect(confirmed).toBeDefined();
    const code = confirmed!.ticketCode;
    const res = call(store, "POST", "checkins/sync", {
      token: host.accessToken,
      body: { scans: [{ ticketCode: code, scannedAt: new Date().toISOString() }, { ticketCode: code, scannedAt: new Date().toISOString() }, { ticketCode: "BOGUS0000000", scannedAt: new Date().toISOString() }] },
    });
    expect(res.status).toBe(200);
    const results = (res.body as { results: Array<{ result: string }> }).results.map((r) => r.result);
    expect(results).toEqual(["checked_in", "duplicate", "invalid"]);
  });

  it("serves offline validation bundles to the event team", () => {
    const store = seedStore();
    const host = login(store, "host@pegwin.in");
    const res = call(store, "GET", "events/evt_002/validation-data", { token: host.accessToken });
    expect(res.status).toBe(200);
    const bundle = res.body as { tickets: unknown[]; eventWindow: object };
    expect(bundle.tickets.length).toBeGreaterThan(0);
    expect(bundle.eventWindow).toBeDefined();
  });
});
