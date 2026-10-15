/**
 * Sample Super Admin endpoints (§13): event review queue and decisions,
 * flagged-host enforcement, verification, report queue, coupons, payouts
 * and the audit log. Every decision writes an audit entry and notifies
 * the affected host.
 */
import {
  asRecord,
  created,
  err,
  needRole,
  needUser,
  ok,
  pageOf,
  qstr,
  type MockHandler,
} from "./router";
import { daysFromNow, nowIso, uid, type MockStore } from "./store";
import { notify } from "./handlers-account";

function needAdmin(store: MockStore, req: Parameters<MockHandler>[1]) {
  const user = needUser(store, req);
  needRole(user, ["super_admin"]);
  return user;
}

function audit(store: MockStore, action: string, actorId: string, entityType: string, entityId: string): void {
  store.auditLog.unshift({ id: uid(store, "aud"), action, actorId, entityType, entityId, createdAt: nowIso() });
}

export const handleAdmin: MockHandler = (store, req) => {
  if (req.segments[0] !== "admin") return null;
  const [, section, third, fourth] = req.segments;
  const body = asRecord(req.body);

  /* ----- platform overview ----- */
  if (section === "overview" && req.method === "GET") {
    needAdmin(store, req);
    const usersByRole: Record<string, number> = { user: 0, host: 0, event_staff: 0, super_admin: 0 };
    for (const u of store.users) usersByRole[u.role] = (usersByRole[u.role] ?? 0) + 1;
    const eventsByStatus: Record<string, number> = {};
    for (const e of store.events) eventsByStatus[e.status] = (eventsByStatus[e.status] ?? 0) + 1;
    const confirmed = store.orders.filter((o) => o.order.status === "confirmed");
    const tickets = Object.values(store.ticketsByCode);
    return ok({
      users: { total: store.users.length, byRole: usersByRole },
      events: { total: store.events.length, byStatus: eventsByStatus },
      tickets: {
        sold: tickets.filter((t) => ["confirmed", "qr_generated", "checked_in", "completed"].includes(t.status)).length,
        checkedIn: tickets.filter((t) => t.status === "checked_in").length,
      },
      revenuePaise: confirmed.reduce((n, o) => n + o.order.amounts.finalPayable, 0),
      pendingPayouts: store.payouts.filter((p) => p.status === "pending" || p.status === "processing").length,
      openReports: Object.values(store.communityReports).flat().filter((r) => r.status === "open").length,
      flaggedHosts: Object.keys(store.flaggedExtra).length,
    });
  }

  /* ----- all events (any status) ----- */
  if (section === "events" && !third && req.method === "GET") {
    needAdmin(store, req);
    const status = qstr(req.query, "status");
    const search = qstr(req.query, "search")?.toLowerCase();
    let list = store.events;
    if (status) list = list.filter((e) => e.status === status);
    if (search) {
      list = list.filter((e) =>
        [e.title, e.city, e.venue, e.category].filter(Boolean).join(" ").toLowerCase().includes(search),
      );
    }
    list = [...list].sort((a, b) => b.startAt.localeCompare(a.startAt));
    return ok(pageOf(list, req.query, 12));
  }

  if (section === "events" && third && fourth === "attendees" && req.method === "GET") {
    needAdmin(store, req);
    const event = store.events.find((e) => e.id === third);
    if (!event) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
    const rows = new Map<string, { orders: number; tickets: number; checkedIn: number; spentPaise: number }>();
    for (const rec of store.orders.filter((o) => o.eventId === third)) {
      const row = rows.get(rec.userId) ?? { orders: 0, tickets: 0, checkedIn: 0, spentPaise: 0 };
      row.orders += 1;
      const tickets = store.orderTickets[rec.order.id] ?? [];
      row.tickets += tickets.length;
      row.checkedIn += tickets.filter((t) => t.status === "checked_in").length;
      if (rec.order.status === "confirmed") row.spentPaise += rec.order.amounts.finalPayable;
      rows.set(rec.userId, row);
    }
    return ok(
      [...rows.entries()].map(([userId, row]) => {
        const user = store.users.find((u) => u.id === userId);
        return {
          user: user ? { id: user.id, name: user.name, username: user.username } : { id: userId, name: userId, username: userId },
          ...row,
        };
      }),
    );
  }

  if (section === "events" && third && fourth === "team" && req.method === "GET") {
    needAdmin(store, req);
    if (!store.events.some((e) => e.id === third)) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
    return ok(store.team[third] ?? []);
  }

  /* ----- all hosts ----- */
  if (section === "hosts" && !third && req.method === "GET") {
    needAdmin(store, req);
    const search = qstr(req.query, "search")?.toLowerCase();
    let hosts = store.users.filter((u) => u.role === "host");
    if (search) {
      hosts = hosts.filter((u) => `${u.name} ${u.username} ${u.email ?? ""}`.toLowerCase().includes(search));
    }
    return ok(
      hosts.map((u) => {
        const mine = store.events.filter((e) => store.eventHost[e.id] === u.id);
        const extra = store.flaggedExtra[u.id];
        return {
          hostId: u.id,
          name: u.name,
          user: { id: u.id, name: u.name, username: u.username },
          eventsHosted: mine.length,
          liveEvents: mine.filter((e) => e.status === "live" || e.status === "on_sale").length,
          cancelledEvents: extra?.cancelledEvents ?? mine.filter((e) => e.status === "cancelled").length,
          cancelledCount: extra?.cancelledEvents ?? mine.filter((e) => e.status === "cancelled").length,
          violations: extra?.violations ?? [],
          status: extra?.status ?? "active",
          joinedAt: u.createdAt,
        };
      }),
    );
  }

  /* ----- review queue ----- */
  if (section === "events" && third === "review-queue" && req.method === "GET") {
    needAdmin(store, req);
    const status = qstr(req.query, "status");
    const list = store.events.filter((e) => (status ? e.status === status : e.status === "review"));
    return ok(pageOf(list, req.query, 12));
  }

  if (section === "events" && third && ["approve", "reject", "suspend", "remove"].includes(fourth ?? "") && req.method === "POST") {
    const actor = needAdmin(store, req);
    const event = store.events.find((e) => e.id === third);
    if (!event) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
    const hostId = store.eventHost[event.id] ?? "";
    if (fourth === "approve") {
      event.status = "published";
      audit(store, "event.approved", actor.id, "event", event.id);
      if (hostId) notify(store, hostId, { type: "review", title: "Event approved", body: `${event.title} is now published.`, refType: "event", refId: event.id });
    } else if (fourth === "reject") {
      event.status = "draft";
      audit(store, "event.rejected", actor.id, "event", event.id);
      if (hostId) notify(store, hostId, { type: "review", title: "Event needs changes", body: `${event.title} was sent back to drafts.`, refType: "event", refId: event.id });
    } else if (fourth === "suspend") {
      audit(store, "event.suspended", actor.id, "event", event.id);
      if (hostId) notify(store, hostId, { type: "review", title: "Event suspended", body: `${event.title} was suspended pending review.`, refType: "event", refId: event.id });
    } else {
      event.status = "cancelled";
      audit(store, "event.removed", actor.id, "event", event.id);
      if (hostId) notify(store, hostId, { type: "review", title: "Event removed", body: `${event.title} was removed from the platform.`, refType: "event", refId: event.id });
    }
    return ok(event);
  }

  /* ----- flagged hosts ----- */
  if (section === "hosts" && third === "flagged" && req.method === "GET") {
    needAdmin(store, req);
    return ok(
      Object.entries(store.flaggedExtra).map(([hostId, extra]) => {
        const user = store.users.find((u) => u.id === hostId);
        return {
          hostId,
          name: user?.name ?? hostId,
          user: user ? { id: user.id, name: user.name, username: user.username } : undefined,
          cancelledEvents: extra.cancelledEvents,
          cancelledCount: extra.cancelledEvents,
          violations: extra.violations,
          status: extra.status,
        };
      }),
    );
  }

  if (section === "hosts" && third && ["warn", "suspend", "remove"].includes(fourth ?? "") && req.method === "POST") {
    const actor = needAdmin(store, req);
    const reason = typeof body.reason === "string" ? body.reason : "";
    if (!reason.trim()) return err(400, "VALIDATION_ERROR", "A reason is required.");
    audit(store, `host.${fourth}`, actor.id, "host", third);
    const extra = store.flaggedExtra[third];
    if (extra && fourth !== "warn") extra.status = fourth === "suspend" ? "suspended" : "removed";
    notify(store, third, { type: "moderation", title: `Host account ${fourth}`, body: `Pegwin took action on your account: ${reason.slice(0, 200)}`, refType: "host", refId: third });
    return ok({});
  }

  if (section === "hosts" && third && fourth === "verification" && req.method === "POST") {
    const actor = needAdmin(store, req);
    const current = store.verificationByHost[third] ?? {};
    store.verificationByHost[third] = {
      ...current,
      identity: { ...(current.identity ?? {}), status: typeof body.identity === "string" ? body.identity : "pending" },
      payoutAccount: { ...(current.payoutAccount ?? {}), status: typeof body.payoutAccount === "string" ? body.payoutAccount : "pending" },
    };
    audit(store, "host.verification_updated", actor.id, "host", third);
    return ok(store.verificationByHost[third]);
  }

  /* ----- report queue ----- */
  if (section === "reports" && !third && req.method === "GET") {
    needAdmin(store, req);
    const status = qstr(req.query, "status");
    const all = Object.values(store.communityReports).flat();
    return ok(pageOf(status ? all.filter((r) => r.status === status) : all, req.query, 12));
  }

  if (section === "reports" && third && (req.method === "PATCH" || req.method === "POST")) {
    const actor = needAdmin(store, req);
    const communityId = store.reportCommunity[third];
    const report = communityId ? (store.communityReports[communityId] ?? []).find((r) => r.id === third) : undefined;
    if (!report) return err(404, "NOT_FOUND", "Report not found.");
    const status = typeof body.status === "string" ? body.status : typeof body.action === "string" && body.action === "dismiss" ? "dismissed" : "actioned";
    if (status === "open" || status === "actioned" || status === "dismissed") report.status = status;
    audit(store, "report.resolved", actor.id, "report", third);
    return ok(report);
  }

  /* ----- coupons ----- */
  if (section === "coupons" && !third && req.method === "GET") {
    needAdmin(store, req);
    return ok(store.coupons);
  }

  if (section === "coupons" && !third && req.method === "POST") {
    needAdmin(store, req);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return err(400, "VALIDATION_ERROR", "A coupon code is required.");
    if (store.coupons.some((c) => c.code === code)) return err(409, "VALIDATION_ERROR", "This code already exists.");
    const coupon = {
      id: uid(store, "cpn"),
      code,
      discountType: (body.discountType === "pct" ? "pct" : "flat") as "flat" | "pct",
      value: typeof body.value === "number" ? Math.round(body.value) : 0,
      eventId: typeof body.eventId === "string" ? body.eventId : null,
      tierId: typeof body.tierId === "string" ? body.tierId : null,
      maxUses: typeof body.maxUses === "number" ? body.maxUses : null,
      usedCount: 0,
      validFrom: typeof body.validFrom === "string" ? body.validFrom : nowIso(),
      validTo: typeof body.validTo === "string" ? body.validTo : daysFromNow(30),
      discountBearer: (typeof body.discountBearer === "string" ? body.discountBearer : "pegwin") as "host" | "pegwin" | "split",
      status: "active",
    };
    store.coupons.push(coupon);
    return created(coupon);
  }

  if (section === "coupons" && third && req.method === "PATCH") {
    needAdmin(store, req);
    const coupon = store.coupons.find((c) => c.id === third);
    if (!coupon) return err(404, "NOT_FOUND", "Coupon not found.");
    if (typeof body.enabled === "boolean") coupon.status = body.enabled ? "active" : "disabled";
    return ok(coupon);
  }

  /* ----- payouts ----- */
  if (section === "payouts" && !third && req.method === "GET") {
    needAdmin(store, req);
    return ok(pageOf(store.payouts, req.query, 12));
  }

  if (section === "payouts" && !third && req.method === "POST") {
    const actor = needAdmin(store, req);
    const payoutId = typeof body.payoutId === "string" ? body.payoutId : "";
    const payout = store.payouts.find((p) => p.id === payoutId);
    if (payout) {
      payout.status = "paid";
      payout.reference = `PEGPO${Date.now().toString(36).toUpperCase()}`;
      audit(store, "payout.processed", actor.id, "payout", payout.id);
      return ok(payout);
    }
    const created_payout = {
      id: uid(store, "po"),
      eventId: typeof body.eventId === "string" ? body.eventId : "",
      hostId: typeof body.hostId === "string" ? body.hostId : "",
      netAmount: typeof body.amount === "number" ? Math.round(body.amount) : 0,
      status: "pending" as const,
      eta: daysFromNow(6),
      reference: null,
    };
    store.payouts.push(created_payout);
    audit(store, "payout.created", actor.id, "payout", created_payout.id);
    return created(created_payout);
  }

  if (section === "payouts" && third && (req.method === "PATCH" || req.method === "POST")) {
    const actor = needAdmin(store, req);
    const payout = store.payouts.find((p) => p.id === third);
    if (!payout) return err(404, "NOT_FOUND", "Payout not found.");
    const status = typeof body.status === "string" ? body.status : "";
    if (status === "pending" || status === "processing" || status === "paid" || status === "failed") {
      payout.status = status;
      if (status === "paid" && !payout.reference) payout.reference = `PEGPO${Date.now().toString(36).toUpperCase()}`;
    }
    audit(store, "payout.updated", actor.id, "payout", payout.id);
    return ok(payout);
  }

  /* ----- audit log ----- */
  if (section === "audit-logs" && req.method === "GET") {
    needAdmin(store, req);
    const action = qstr(req.query, "action");
    const list = action ? store.auditLog.filter((a) => a.action.includes(action)) : store.auditLog;
    return ok(pageOf(list, req.query, 20));
  }

  return null;
};
