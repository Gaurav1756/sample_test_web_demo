/**
 * Sample ticketing endpoints (§6, §7, §8): holds with 10-minute TTL,
 * coupon validation, server quotes (BRD pricing chain), idempotent
 * orders, simulated payments (immediate success, clearly labelled),
 * tickets, receipts, cancellations with refunds, and tier management.
 */
import type { EventDetail, Order, Tier } from "../api-types";
import { quoteForItems } from "./pricing";
import {
  asRecord,
  created,
  err,
  needUser,
  ok,
  pageOf,
  qstr,
  type MockHandler,
} from "./router";
import { nowIso, ticketCode, uid, type MockStore } from "./store";
import { notify } from "./handlers-account";
import { liveTiers } from "./handlers-events";

const HOLD_TTL_MIN = 10;

function findTier(store: MockStore, tierId: string): { event: EventDetail; tier: Tier } | null {
  for (const event of store.events) {
    const tier = (store.tiers[event.id] ?? []).find((t) => t.id === tierId);
    if (tier) return { event, tier };
  }
  return null;
}

function activeHeld(store: MockStore, tierId: string): number {
  const now = Date.now();
  return store.holds
    .filter((h) => h.status === "active" && new Date(h.expiresAt).getTime() > now)
    .flatMap((h) => h.items)
    .filter((i) => i.tierId === tierId)
    .reduce((n, i) => n + i.qty, 0);
}

function available(store: MockStore, tier: Tier): number {
  return Math.max(0, tier.capacity - tier.soldCount - activeHeld(store, tier.id));
}

function liveHold(store: MockStore, holdId: string, userId: string) {
  const hold = store.holds.find((h) => h.holdId === holdId && h.userId === userId && h.status === "active");
  if (!hold) return null;
  if (new Date(hold.expiresAt).getTime() <= Date.now()) {
    hold.status = "released";
    return null;
  }
  return hold;
}

/** Discount in paise for a coupon against a display total (0 when unusable). */
function couponDiscount(store: MockStore, code: string | undefined, displayTotal: number): { discount: number; valid: boolean; reason?: string } {
  if (!code) return { discount: 0, valid: true };
  const coupon = store.coupons.find((c) => c.code.toLowerCase() === code.toLowerCase());
  const now = nowIso();
  if (!coupon || coupon.status !== "active") return { discount: 0, valid: false, reason: "Unknown or disabled code." };
  if ((coupon.validFrom && coupon.validFrom > now) || (coupon.validTo && coupon.validTo < now)) {
    return { discount: 0, valid: false, reason: "This coupon is not valid right now." };
  }
  if (coupon.maxUses != null && (coupon.usedCount ?? 0) >= coupon.maxUses) {
    return { discount: 0, valid: false, reason: "This coupon has reached its usage limit." };
  }
  const discount = coupon.discountType === "pct"
    ? Math.round((displayTotal * coupon.value) / 100)
    : Math.min(coupon.value, displayTotal);
  return { discount, valid: true };
}

function orderAccess(store: MockStore, orderId: string, userId: string, role: string) {
  const rec = store.orders.find((o) => o.order.id === orderId);
  if (!rec) return null;
  if (rec.userId === userId || role === "super_admin") return rec;
  if (role === "host" && store.eventHost[rec.eventId] === userId) return rec;
  return null;
}

export const handleCheckout: MockHandler = (store, req) => {
  const head = req.segments[0];
  const body = asRecord(req.body);

  /* ----- tier management (head "tiers") ----- */
  if (head === "tiers" && req.segments[1]) {
    const found = findTier(store, req.segments[1]);
    if (!found) return err(404, "NOT_FOUND", "Tier not found.");
    const actor = needUser(store, req);
    const ownerId = store.eventHost[found.event.id];
    if (actor.role !== "super_admin" && ownerId !== actor.id) return err(403, "FORBIDDEN", "Only this event's host can manage tiers.");
    if (req.method === "PATCH") {
      if (typeof body.name === "string" && body.name.trim()) found.tier.name = body.name.trim();
      if (typeof body.price === "number" && body.price >= 0) found.tier.price = Math.round(body.price);
      if (typeof body.capacity === "number") {
        if (body.capacity < found.tier.soldCount) {
          return err(409, "TIER_CAPACITY_CONFLICT", "Capacity cannot be set below tickets already sold.");
        }
        found.tier.capacity = Math.floor(body.capacity);
      }
      found.tier.availableCount = available(store, found.tier);
      found.event.minPrice = Math.min(...(store.tiers[found.event.id] ?? [found.tier]).map((t) => t.price));
      return ok(found.tier);
    }
    if (req.method === "DELETE") {
      if (found.tier.soldCount > 0) {
        return err(409, "TIER_HAS_SALES", "This tier cannot be removed because it has sales.");
      }
      store.tiers[found.event.id] = (store.tiers[found.event.id] ?? []).filter((t) => t.id !== found.tier.id);
      const rest = liveTiers(store, found.event.id);
      found.event.minPrice = rest.length ? Math.min(...rest.map((t) => t.price)) : 0;
      return ok({});
    }
    return null;
  }

  /* ----- holds ----- */
  if (head === "checkout" && req.segments[1] === "holds" && !req.segments[2] && req.method === "POST") {
    const actor = needUser(store, req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return err(400, "VALIDATION_ERROR", "Select at least one ticket.");
    let eventId = "";
    for (const raw of items) {
      const item = asRecord(raw);
      const tierId = typeof item.tierId === "string" ? item.tierId : "";
      const qty = typeof item.qty === "number" ? Math.floor(item.qty) : 0;
      const found = findTier(store, tierId);
      if (!found || qty < 1 || qty > 10) return err(400, "VALIDATION_ERROR", "Invalid ticket selection.");
      if (!["on_sale", "live", "published", "rescheduled"].includes(found.event.status)) {
        return err(409, "EVENT_NOT_LIVE", "This event is not on sale right now.");
      }
      if (qty > available(store, found.tier)) {
        return err(409, "INSUFFICIENT_INVENTORY", "Not enough tickets are available.");
      }
      eventId = found.event.id;
    }
    const hold = {
      holdId: uid(store, "hold"),
      userId: actor.id,
      eventId,
      items: items.map((raw) => {
        const item = asRecord(raw);
        return { tierId: item.tierId as string, qty: Math.floor(item.qty as number) };
      }),
      expiresAt: new Date(Date.now() + HOLD_TTL_MIN * 60000).toISOString(),
      status: "active" as const,
    };
    store.holds.push(hold);
    return created({ holdId: hold.holdId, expiresAt: hold.expiresAt, status: "active" });
  }

  if (head === "checkout" && req.segments[1] === "holds" && req.segments[2]) {
    const actor = needUser(store, req);
    const hold = store.holds.find((h) => h.holdId === req.segments[2] && h.userId === actor.id);
    if (!hold || hold.status !== "active") return err(404, "HOLD_EXPIRED", "This hold is no longer active.");
    if (req.method === "DELETE") {
      hold.status = "released";
      return ok({});
    }
    if (req.method === "GET") {
      if (new Date(hold.expiresAt).getTime() <= Date.now()) {
        hold.status = "released";
        return err(404, "HOLD_EXPIRED", "This hold has expired.");
      }
      return ok({ holdId: hold.holdId, expiresAt: hold.expiresAt, status: "active" });
    }
    return null;
  }

  /* ----- coupon validation ----- */
  if (head === "checkout" && req.segments[1] === "coupons" && req.method === "POST") {
    needUser(store, req);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const found = typeof body.tierId === "string" ? findTier(store, body.tierId) : null;
    const qty = typeof body.qty === "number" && body.qty > 0 ? Math.floor(body.qty) : 1;
    if (!found) return ok({ valid: false, discount: 0, reason: "Unknown tier." });
    const hostPrice = found.tier.price * qty;
    const display = hostPrice + Math.round((hostPrice * 10) / 100);
    const { discount, valid, reason } = couponDiscount(store, code, display);
    return ok(valid ? { valid: true, discount } : { valid: false, discount: 0, reason });
  }

  /* ----- server quote ----- */
  if (head === "checkout" && req.segments[1] === "quote" && req.method === "POST") {
    needUser(store, req);
    const items = Array.isArray(body.items) ? body.items : [];
    const priced = [];
    for (const raw of items) {
      const item = asRecord(raw);
      const found = typeof item.tierId === "string" ? findTier(store, item.tierId) : null;
      const qty = typeof item.qty === "number" ? Math.floor(item.qty) : 0;
      if (!found || qty < 1) return err(400, "VALIDATION_ERROR", "Invalid ticket selection.");
      priced.push({ tierId: found.tier.id, qty, unitHostPrice: found.tier.price });
    }
    if (priced.length === 0) return err(400, "VALIDATION_ERROR", "Select at least one ticket.");
    const display = priced.reduce((n, i) => n + i.unitHostPrice * i.qty * 1.1, 0);
    const couponCode = typeof body.couponCode === "string" ? body.couponCode : undefined;
    const { discount } = couponDiscount(store, couponCode, Math.round(display));
    return ok(quoteForItems(priced, discount));
  }

  /* ----- orders ----- */
  if (head === "orders" && !req.segments[1] && req.method === "POST") {
    const actor = needUser(store, req);
    if (req.idempotencyKey && req.idempotencyKey in store.idempotency) {
      return ok(store.idempotency[req.idempotencyKey]);
    }
    const holdId = typeof body.holdId === "string" ? body.holdId : "";
    const hold = liveHold(store, holdId, actor.id);
    if (!hold) return err(404, "HOLD_EXPIRED", "This hold has expired. Select tickets again.");
    const attendees = Array.isArray(body.attendees) ? body.attendees : [];
    const totalQty = hold.items.reduce((n, i) => n + i.qty, 0);
    if (attendees.length !== totalQty) return err(400, "VALIDATION_ERROR", "Attendee details are incomplete.");
    for (const raw of attendees) {
      if (!asRecord(raw).name || typeof asRecord(raw).name !== "string" || !(asRecord(raw).name as string).trim()) {
        return err(400, "VALIDATION_ERROR", "Every ticket needs an attendee name.");
      }
    }
    const priced = [];
    for (const item of hold.items) {
      const found = findTier(store, item.tierId);
      if (!found) return err(400, "VALIDATION_ERROR", "Invalid ticket selection.");
      priced.push({ tierId: item.tierId, qty: item.qty, unitHostPrice: found.tier.price });
    }
    const display = priced.reduce((n, i) => n + i.unitHostPrice * i.qty * 1.1, 0);
    const couponCode = typeof body.couponCode === "string" ? body.couponCode : undefined;
    const { discount } = couponDiscount(store, couponCode, Math.round(display));
    const quote = quoteForItems(priced, discount);
    const event = store.events.find((e) => e.id === hold.eventId);
    if (!event) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
    const order: Order = {
      id: uid(store, "ord"),
      eventId: hold.eventId,
      items: priced.map((p) => {
        const found = findTier(store, p.tierId) as { tier: Tier };
        const fee = Math.round((p.unitHostPrice * 10) / 100);
        return { tierId: p.tierId, tierName: found.tier.name, qty: p.qty, unitPrice: p.unitHostPrice + fee };
      }),
      amounts: quote.totals,
      status: "pending",
      createdAt: nowIso(),
    };
    for (const item of hold.items) {
      const found = findTier(store, item.tierId);
      if (found) {
        found.tier.soldCount += item.qty;
        found.tier.availableCount = available(store, found.tier);
      }
    }
    hold.status = "consumed";
    const tickets = attendees.map((raw) => {
      const a = asRecord(raw);
      // Distribute attendee rows across hold items in order.
      return { name: String(a.name), phone: typeof a.phone === "string" ? a.phone : undefined, email: typeof a.email === "string" ? a.email : undefined };
    });
    let cursor = 0;
    const made = [];
    for (const item of hold.items) {
      const found = findTier(store, item.tierId) as { tier: Tier };
      for (let k = 0; k < item.qty; k += 1) {
        const a = tickets[cursor++] ?? { name: actor.name };
        const code = ticketCode(store);
        made.push({
          ticketCode: code,
          qrPayload: `PGW1:${code}:${hold.eventId}`,
          attendee: { name: a.name, ...(a.phone ? { phone: a.phone } : {}), ...(a.email ? { email: a.email } : {}) },
          tierName: found.tier.name,
          verified: true,
          status: "pending" as const,
          checkedInAt: null,
          event: { id: event.id, title: event.title, startAt: event.startAt, venue: event.venue, address: event.address },
          eventId: hold.eventId,
          orderId: order.id,
        });
      }
    }
    for (const t of made) store.ticketsByCode[t.ticketCode] = t;
    store.orderTickets[order.id] = made;
    store.orders.push({ order, userId: actor.id, eventId: hold.eventId, holdId, couponCode });
    if (couponCode) {
      const coupon = store.coupons.find((c) => c.code.toLowerCase() === couponCode.toLowerCase());
      if (coupon) coupon.usedCount = (coupon.usedCount ?? 0) + 1;
    }
    if (req.idempotencyKey) store.idempotency[req.idempotencyKey] = order;
    return created(order);
  }

  if (head === "orders" && req.segments[1] && !req.segments[2] && req.method === "GET") {
    const actor = needUser(store, req);
    const rec = orderAccess(store, req.segments[1], actor.id, actor.role);
    if (!rec) return err(404, "NOT_FOUND", "Order not found.");
    return ok(rec.order);
  }

  if (head === "orders" && req.segments[2] === "tickets" && req.method === "GET") {
    const actor = needUser(store, req);
    const rec = orderAccess(store, req.segments[1], actor.id, actor.role);
    if (!rec) return err(404, "NOT_FOUND", "Order not found.");
    return ok(store.orderTickets[rec.order.id] ?? []);
  }

  if (head === "orders" && req.segments[2] === "receipt" && req.method === "GET") {
    const actor = needUser(store, req);
    const rec = orderAccess(store, req.segments[1], actor.id, actor.role);
    if (!rec) return err(404, "NOT_FOUND", "Order not found.");
    if (rec.order.status !== "confirmed") return err(409, "VALIDATION_ERROR", "Receipts are available for confirmed orders.");
    const payment = store.payments.find((p) => p.orderId === rec.order.id);
    return ok({
      receiptUrl: `/receipts/${rec.order.id}.pdf`,
      transactionId: payment?.id ?? rec.order.id,
      amount: rec.order.amounts.finalPayable,
      paymentMethod: payment?.gateway === "cashfree" ? "Cashfree" : "Razorpay",
    });
  }

  if (head === "orders" && req.segments[2] === "cancel" && req.method === "POST") {
    const actor = needUser(store, req);
    const rec = store.orders.find((o) => o.order.id === req.segments[1] && o.userId === actor.id);
    if (!rec) return err(404, "NOT_FOUND", "Order not found.");
    if (rec.order.status === "cancelled") {
      return ok({ status: "cancelled", refundAmount: 0 });
    }
    if (rec.order.status !== "confirmed") {
      return err(409, "VALIDATION_ERROR", "Only confirmed orders can be cancelled.");
    }
    rec.order.status = "cancelled";
    for (const t of store.orderTickets[rec.order.id] ?? []) t.status = "cancelled";
    const payment = store.payments.find((p) => p.orderId === rec.order.id);
    const refundId = uid(store, "ref");
    if (payment) {
      const list = store.refunds[payment.id] ?? [];
      list.push({ refundId, status: "processed", amount: rec.order.amounts.finalPayable, reason: "Booking cancelled by user", createdAt: nowIso() });
      store.refunds[payment.id] = list;
      payment.status = "refunded";
    }
    notify(store, actor.id, { type: "refund", title: "Booking cancelled", body: `Refund of ₹${(rec.order.amounts.finalPayable / 100).toFixed(2)} is on its way.`, refType: "order", refId: rec.order.id });
    return ok({ status: "cancelled", refundAmount: rec.order.amounts.finalPayable, refundId });
  }

  /* ----- payments (simulated: intent confirms immediately) ----- */
  if (head === "payments" && req.segments[1] === "intents" && req.method === "POST") {
    const actor = needUser(store, req);
    if (req.idempotencyKey && req.idempotencyKey in store.idempotency) {
      return ok(store.idempotency[req.idempotencyKey]);
    }
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const rec = store.orders.find((o) => o.order.id === orderId && o.userId === actor.id);
    if (!rec) return err(404, "NOT_FOUND", "Order not found.");
    if (rec.order.status === "confirmed") {
      return err(409, "PAYMENT_ALREADY_EXISTS", "A payment already exists for this order.");
    }
    const existing = store.payments.find((p) => p.orderId === orderId);
    if (existing && existing.status === "success") {
      return err(409, "PAYMENT_ALREADY_EXISTS", "A payment already exists for this order.");
    }
    const gateway = store.payments.length % 2 === 0 ? "razorpay" : "cashfree";
    const paymentId = existing?.id ?? uid(store, "pay");
    const now = nowIso();
    const payment = existing ?? {
      id: paymentId, orderId, userId: actor.id, amount: rec.order.amounts.finalPayable,
      gateway, gatewayOrderId: `gw_${paymentId}`, status: "pending" as const, attempts: 0,
      createdAt: now, confirmedAt: null,
    };
    if (!existing) store.payments.push(payment);
    payment.attempts += 1;
    payment.status = "success";
    payment.confirmedAt = now;
    rec.order.status = "confirmed";
    for (const t of store.orderTickets[orderId] ?? []) {
      if (t.status === "pending") t.status = "confirmed";
    }
    const intent = { paymentId: payment.id, gateway, gatewayOrderId: payment.gatewayOrderId, checkoutPayload: { simulated: true, method: body.method ?? "upi" } };
    if (req.idempotencyKey) store.idempotency[req.idempotencyKey] = intent;
    notify(store, actor.id, { type: "ticket", title: "Payment successful (simulated)", body: `Order ${orderId} confirmed. This was a simulated payment — no real charge.`, refType: "order", refId: orderId });
    return created(intent);
  }

  if (head === "payments" && req.segments[1] && !req.segments[2] && req.method === "GET") {
    const actor = needUser(store, req);
    const payment = store.payments.find((p) => p.id === req.segments[1]);
    if (!payment) return err(404, "NOT_FOUND", "Payment not found.");
    const rec = store.orders.find((o) => o.order.id === payment.orderId);
    const hostOk = actor.role === "host" && rec && store.eventHost[rec.eventId] === actor.id;
    if (payment.userId !== actor.id && actor.role !== "super_admin" && !hostOk) {
      return err(403, "FORBIDDEN", "You do not have permission for this action.");
    }
    return ok({ id: payment.id, orderId: payment.orderId, amount: payment.amount, gateway: payment.gateway, status: payment.status, attempts: payment.attempts, createdAt: payment.createdAt, confirmedAt: payment.confirmedAt });
  }

  if (head === "payments" && req.segments[2] === "refunds" && req.method === "GET") {
    needUser(store, req);
    return ok(store.refunds[req.segments[1]] ?? []);
  }

  /* ----- tickets ----- */
  if (head === "tickets" && req.segments[1] && req.method === "GET") {
    const actor = needUser(store, req);
    const ticket = store.ticketsByCode[req.segments[1].toUpperCase()];
    if (!ticket) return err(404, "TICKET_INVALID_OR_EXPIRED", "This ticket is invalid or has expired.");
    const rec = store.orders.find((o) => o.order.id === ticket.orderId);
    const hostOk = actor.role === "host" && store.eventHost[ticket.eventId] === actor.id;
    if (rec?.userId !== actor.id && actor.role !== "super_admin" && !hostOk) {
      return err(403, "FORBIDDEN", "You do not have permission for this action.");
    }
    return ok(ticket);
  }

  /* ----- my orders / tickets / payments ----- */
  if (head === "users" && req.segments[1] === "me" && req.segments[2] === "orders" && req.method === "GET") {
    const actor = needUser(store, req);
    return ok(store.orders.filter((o) => o.userId === actor.id).map((o) => o.order));
  }

  if (head === "users" && req.segments[1] === "me" && req.segments[2] === "tickets" && req.method === "GET") {
    const actor = needUser(store, req);
    const myOrderIds = new Set(store.orders.filter((o) => o.userId === actor.id).map((o) => o.order.id));
    let tickets = Object.values(store.ticketsByCode).filter((t) => myOrderIds.has(t.orderId));
    const tab = qstr(req.query, "status") ?? "active";
    if (tab === "active") tickets = tickets.filter((t) => ["pending", "confirmed", "qr_generated"].includes(t.status));
    else if (tab === "used") tickets = tickets.filter((t) => ["checked_in", "completed"].includes(t.status));
    else tickets = tickets.filter((t) => ["expired", "cancelled", "refunded"].includes(t.status));
    return ok(tickets);
  }

  if (head === "users" && req.segments[1] === "me" && req.segments[2] === "payments" && req.method === "GET") {
    const actor = needUser(store, req);
    const mine = store.payments
      .filter((p) => p.userId === actor.id)
      .map((p) => ({ id: p.id, orderId: p.orderId, amount: p.amount, gateway: p.gateway, status: p.status, attempts: p.attempts, createdAt: p.createdAt, confirmedAt: p.confirmedAt }));
    return ok(pageOf(mine, req.query));
  }

  return null;
};
