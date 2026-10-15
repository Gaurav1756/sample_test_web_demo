/**
 * Sample event endpoints (§4, §5): public discovery with documented
 * filters, detail/agenda/attendees/tiers, ratings, and host event
 * mutations (create, edit, submit, reschedule, cancel, rehost, team,
 * check-ins, analytics, offline validation bundle).
 */
import type { EventDetail, EventStatus, Tier } from "../api-types";
import {
  asRecord,
  created,
  err,
  needRole,
  needUser,
  ok,
  pageOf,
  qnum,
  qstr,
  type MockHandler,
} from "./router";
import { daysFromNow, nowIso, uid, type MockStore } from "./store";
import { notify } from "./handlers-account";

const PUBLIC_STATUSES: EventStatus[] = ["published", "on_sale", "live", "rescheduled"];

function activeHeld(store: MockStore, tierId: string): number {
  const now = Date.now();
  return store.holds
    .filter((h) => h.status === "active" && new Date(h.expiresAt).getTime() > now)
    .flatMap((h) => h.items)
    .filter((i) => i.tierId === tierId)
    .reduce((n, i) => n + i.qty, 0);
}

export function liveTiers(store: MockStore, eventId: string): Tier[] {
  return (store.tiers[eventId] ?? []).map((t) => ({
    ...t,
    availableCount: Math.max(0, t.capacity - t.soldCount - activeHeld(store, t.id)),
  }));
}

function refreshCard(store: MockStore, event: EventDetail): void {
  const tiers = liveTiers(store, event.id);
  event.minPrice = tiers.length ? Math.min(...tiers.map((t) => t.price)) : 0;
  event.soldCount = tiers.reduce((n, t) => n + t.soldCount, 0);
  event.tiers = tiers;
}

function withSaved(store: MockStore, userId: string | null, event: EventDetail): EventDetail {
  const saved = userId ? store.savedEvents.some((s) => s.userId === userId && s.eventId === event.id) : false;
  refreshCard(store, event);
  return { ...event, isSaved: saved };
}

function canManageEvent(store: MockStore, userId: string, role: string, eventId: string): boolean {
  if (role === "super_admin") return true;
  if (store.eventHost[eventId] === userId) return true;
  return (store.team[eventId] ?? []).some(
    (m) => (m.userId ?? m.memberId ?? m.user?.id) === userId && (m.permissions ?? []).includes("manage_event"),
  );
}

export const handleEvents: MockHandler = (store, req, user) => {
  if (req.segments[0] !== "events") return null;
  const [, id, sub] = req.segments;
  const body = asRecord(req.body);

  /* ----- GET /events (discovery) ----- */
  if (!id && req.method === "GET") {
    const statusParam = qstr(req.query, "status");
    let list = store.events.filter((e) =>
      statusParam ? e.status === statusParam : PUBLIC_STATUSES.includes(e.status),
    );
    const search = qstr(req.query, "search")?.toLowerCase();
    if (search) {
      list = list.filter((e) =>
        [e.title, e.description, e.city, e.venue, e.category].filter(Boolean).join(" ").toLowerCase().includes(search),
      );
    }
    const city = qstr(req.query, "city")?.toLowerCase();
    if (city) list = list.filter((e) => (e.city ?? "").toLowerCase() === city);
    const category = qstr(req.query, "category");
    if (category) list = list.filter((e) => e.category === category);
    if (qstr(req.query, "pricingModel") === "free") list = list.filter((e) => e.minPrice === 0);
    if (qstr(req.query, "pricingModel") === "paid") list = list.filter((e) => e.minPrice > 0);
    const dateFrom = qstr(req.query, "dateFrom");
    if (dateFrom) list = list.filter((e) => e.startAt >= dateFrom);
    const dateTo = qstr(req.query, "dateTo");
    if (dateTo) list = list.filter((e) => e.startAt <= dateTo);
    const priceMin = qnum(req.query, "priceMin");
    if (priceMin !== undefined) list = list.filter((e) => e.minPrice >= priceMin);
    const priceMax = qnum(req.query, "priceMax");
    if (priceMax !== undefined) list = list.filter((e) => e.minPrice <= priceMax);
    list = [...list].sort((a, b) => a.startAt.localeCompare(b.startAt));
    const page = pageOf(list, req.query, 12);
    return ok({ ...page, data: page.data.map((e) => withSaved(store, user?.id ?? null, e)) });
  }

  /* ----- POST /events (host creates a draft) ----- */
  if (!id && req.method === "POST") {
    const actor = needUser(store, req);
    needRole(actor, ["host", "super_admin"]);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return err(400, "VALIDATION_ERROR", "A title is required.");
    const eventId = uid(store, "evt");
    const event: EventDetail = {
      id: eventId,
      title,
      coverImage: null,
      category: typeof body.category === "string" ? body.category : null,
      city: typeof body.city === "string" ? body.city : actor.city ?? null,
      venue: typeof body.venue === "string" ? body.venue : null,
      startAt: typeof body.startAt === "string" ? body.startAt : daysFromNow(30),
      endAt: typeof body.endAt === "string" ? body.endAt : daysFromNow(30.2),
      status: "draft",
      minPrice: 0,
      soldCount: 0,
      goingCount: 0,
      avgRating: null,
      description: typeof body.description === "string" ? body.description : "",
      language: typeof body.language === "string" ? body.language : null,
      targetAudience: typeof body.targetAudience === "string" ? body.targetAudience : null,
      maxAttendees: typeof body.maxAttendees === "number" ? body.maxAttendees : null,
      agenda: [],
      address: typeof body.address === "string" ? body.address : null,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      tiers: [],
      policies: {},
      host: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl ?? null },
    };
    store.events.push(event);
    store.eventHost[eventId] = actor.id;
    store.tiers[eventId] = [];
    return created(event);
  }

  if (!id) return null;
  const event = store.events.find((e) => e.id === id);
  if (!event) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");

  /* ----- GET /events/:id ----- */
  if (!sub && req.method === "GET") {
    if ((event.status === "draft" || event.status === "review") && user?.role !== "super_admin" && store.eventHost[id] !== user?.id) {
      return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
    }
    return ok(withSaved(store, user?.id ?? null, event));
  }

  /* ----- PATCH /events/:id ----- */
  if (!sub && req.method === "PATCH") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can edit it.");
    if (event.status === "cancelled" || event.status === "completed") {
      return err(409, "EVENT_NOT_EDITABLE", "This event can no longer be edited.");
    }
    for (const key of ["title", "description", "category", "city", "venue", "address", "language", "targetAudience", "startAt", "endAt", "coverImage"] as const) {
      if (typeof body[key] === "string") (event[key] as string | null) = body[key] as string;
    }
    if (typeof body.maxAttendees === "number") event.maxAttendees = body.maxAttendees;
    if (typeof body.latitude === "number") event.latitude = body.latitude;
    if (typeof body.longitude === "number") event.longitude = body.longitude;
    const policies = asRecord(body.policies);
    if (typeof body.refundPolicy === "string" || typeof body.entryRules === "string" || Object.keys(policies).length > 0) {
      event.policies = {
        ...(event.policies ?? {}),
        ...(typeof body.refundPolicy === "string" ? { refundPolicy: body.refundPolicy } : {}),
        ...(typeof body.entryRules === "string" ? { entryRules: body.entryRules } : {}),
        ...(typeof policies.refundPolicy === "string" ? { refundPolicy: policies.refundPolicy as string } : {}),
        ...(typeof policies.entryRules === "string" ? { entryRules: policies.entryRules as string } : {}),
        ...(typeof policies.ageRestriction === "string" ? { ageRestriction: policies.ageRestriction as string } : {}),
      };
    }
    return ok(withSaved(store, actor.id, event));
  }

  if (sub === "agenda" && req.method === "GET") {
    return ok({ slots: event.agenda ?? [] });
  }

  if (sub === "agenda" && (req.method === "POST" || req.method === "PUT")) {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can edit it.");
    if (Array.isArray(body.slots)) {
      event.agenda = body.slots
        .filter((s): s is { time: string; title: string } => typeof (s as { title?: unknown }).title === "string")
        .map((s) => ({ time: typeof s.time === "string" ? s.time : "", title: s.title }));
    }
    return ok({ slots: event.agenda ?? [] });
  }

  if (sub === "attendees" && req.method === "GET") {
    const attendees = store.users.slice(0, 8).map((u) => ({ id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl ?? null }));
    return ok({ attendees, goingCount: event.goingCount });
  }

  if (sub === "tiers" && req.method === "GET") {
    return ok(liveTiers(store, id));
  }

  if (sub === "tiers" && req.method === "POST") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can edit tiers.");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const price = typeof body.price === "number" ? body.price : -1;
    const capacity = typeof body.capacity === "number" ? body.capacity : 0;
    if (!name || price < 0 || capacity < 1) return err(400, "VALIDATION_ERROR", "Tier needs a name, price and capacity.");
    const tier: Tier = { id: uid(store, "tier"), name, price: Math.round(price), capacity, soldCount: 0, availableCount: capacity };
    store.tiers[id] = [...(store.tiers[id] ?? []), tier];
    refreshCard(store, event);
    return created(tier);
  }

  if (sub === "ratings" && req.method === "POST") {
    const actor = needUser(store, req);
    const rating = typeof body.rating === "number" ? body.rating : 0;
    if (!(rating >= 1 && rating <= 5)) return err(400, "VALIDATION_ERROR", "Rating must be between 1 and 5.");
    const agg = store.ratings[id] ?? { sum: 0, count: 0 };
    agg.sum += rating;
    agg.count += 1;
    store.ratings[id] = agg;
    event.avgRating = Math.round((agg.sum / agg.count) * 10) / 10;
    void actor;
    return created({ avg: event.avgRating, avgRating: event.avgRating, ratingCount: agg.count });
  }

  if (sub === "submit-review" && req.method === "POST") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can submit it.");
    if (event.status !== "draft") return err(409, "VALIDATION_ERROR", "Only drafts can be submitted for review.");
    event.status = "review";
    return ok(withSaved(store, actor.id, event));
  }

  if (sub === "reschedule" && req.method === "POST") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can reschedule it.");
    if (typeof body.startAt === "string") event.startAt = body.startAt;
    if (typeof body.endAt === "string") event.endAt = body.endAt;
    event.status = "rescheduled";
    for (const o of store.orders.filter((o) => o.eventId === id)) {
      notify(store, o.userId, { type: "event_update", title: "Event rescheduled", body: `${event.title} has a new date. Refund options are available from your booking.`, refType: "event", refId: id });
    }
    return ok(withSaved(store, actor.id, event));
  }

  if (sub === "cancel" && req.method === "POST") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can cancel it.");
    if (event.status === "cancelled") return ok(withSaved(store, actor.id, event));
    event.status = "cancelled";
    for (const o of store.orders.filter((o) => o.eventId === id && o.order.status === "confirmed")) {
      const payment = store.payments.find((p) => p.orderId === o.order.id);
      if (payment) {
        const list = store.refunds[payment.id] ?? [];
        list.push({ refundId: uid(store, "ref"), status: "processed", amount: o.order.amounts.finalPayable, reason: "Event cancelled by host", createdAt: nowIso() });
        store.refunds[payment.id] = list;
        payment.status = "refunded";
      }
      for (const t of store.orderTickets[o.order.id] ?? []) t.status = "refunded";
      notify(store, o.userId, { type: "refund", title: "Event cancelled", body: `${event.title} was cancelled. Your refund is on its way.`, refType: "event", refId: id });
    }
    return ok(withSaved(store, actor.id, event));
  }

  if (sub === "rehost" && req.method === "POST") {
    const actor = needUser(store, req);
    needRole(actor, ["host", "super_admin"]);
    const eventId = uid(store, "evt");
    const clone: EventDetail = {
      ...event,
      id: eventId,
      title: `${event.title} (encore)`,
      status: "draft",
      soldCount: 0,
      goingCount: 0,
      avgRating: null,
      startAt: daysFromNow(30),
      endAt: daysFromNow(30.2),
    };
    store.events.push(clone);
    store.eventHost[eventId] = actor.id;
    store.tiers[eventId] = (store.tiers[id] ?? []).map((t) => ({ ...t, id: uid(store, "tier"), soldCount: 0, availableCount: t.capacity }));
    refreshCard(store, clone);
    return created(clone);
  }

  if (sub === "team" && req.method === "GET") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can view it.");
    return ok(store.team[id] ?? []);
  }

  if (sub === "team" && req.method === "POST") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can manage it.");
    const contact = typeof body.email === "string" ? body.email.toLowerCase() : typeof body.userId === "string" ? body.userId : "";
    const target = store.users.find((u) => u.id === contact || u.email?.toLowerCase() === contact);
    if (!target) return err(404, "NOT_FOUND", "No user found for these details.");
    const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p): p is string => p === "manage_event" || p === "scan_tickets") : ["scan_tickets"];
    const list = store.team[id] ?? [];
    if (!list.some((m) => (m.userId ?? m.memberId ?? m.user?.id) === target.id)) {
      list.push({ userId: target.id, user: { id: target.id, name: target.name, username: target.username }, permissions, status: "active" });
    }
    store.team[id] = list;
    return created(list);
  }

  if (sub === "team" && req.segments[3] && (req.method === "PATCH" || req.method === "DELETE")) {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can manage it.");
    const key = req.segments[3];
    const list = store.team[id] ?? [];
    const member = list.find((m) => (m.userId ?? m.memberId ?? m.user?.id) === key);
    if (!member) return err(404, "NOT_FOUND", "Team member not found.");
    if (req.method === "DELETE") {
      store.team[id] = list.filter((m) => m !== member);
      return ok({});
    }
    if (Array.isArray(body.permissions)) {
      member.permissions = body.permissions.filter((p): p is string => p === "manage_event" || p === "scan_tickets");
    }
    return ok(member);
  }

  if (sub === "checkins" && req.method === "GET") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id) && actor.role !== "event_staff") {
      return err(403, "FORBIDDEN", "Only this event's host team can view check-ins.");
    }
    return ok(store.checkins.filter((c) => c.eventId === id));
  }

  if (sub === "analytics" && req.method === "GET") {
    const actor = needUser(store, req);
    if (!canManageEvent(store, actor.id, actor.role, id)) return err(403, "FORBIDDEN", "Only this event's host team can view analytics.");
    return ok(store.analytics);
  }

  if (sub === "validation-data" && req.method === "GET") {
    const actor = needUser(store, req);
    const staffOk = actor.role === "event_staff" && (store.team[id] ?? []).some((m) => (m.userId ?? m.memberId ?? m.user?.id) === actor.id);
    if (!canManageEvent(store, actor.id, actor.role, id) && !staffOk) {
      return err(403, "FORBIDDEN", "Only this event's team can download validation data.");
    }
    const tickets = Object.values(store.ticketsByCode).filter((t) => t.eventId === id && (t.status === "confirmed" || t.status === "qr_generated" || t.status === "checked_in"));
    return ok({
      eventId: id,
      generatedAt: nowIso(),
      tickets: tickets.map((t) => ({ ticketCode: t.ticketCode, qrHash: `hash_${t.ticketCode}`, tierId: "", attendee: t.attendee.name })),
      eventWindow: { startAt: event.startAt, endAt: event.endAt },
    });
  }

  return null;
};
