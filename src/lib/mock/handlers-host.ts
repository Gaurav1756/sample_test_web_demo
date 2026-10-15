/**
 * Sample host endpoints (§5, §9, §10, §12b): my events, analytics, invoices,
 * payout schedule/requests/accounts, ledger, tax, verification, and ticket
 * check-in (online single-accept + offline first-wins sync).
 */
import type { User } from "../api-types";
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

/** Hosts see their own rows; super_admin sees the first host's (sample data). */
function hostScope(store: MockStore, user: User): string {
  if (user.role === "host") return user.id;
  const host = store.users.find((u) => u.role === "host");
  return host?.id ?? user.id;
}

function canScan(store: MockStore, actor: User, eventId: string): boolean {
  if (actor.role === "super_admin") return true;
  if (actor.role === "host" && store.eventHost[eventId] === actor.id) return true;
  if (actor.role === "event_staff") {
    return (store.team[eventId] ?? []).some(
      (m) => (m.userId ?? m.memberId ?? m.user?.id) === actor.id && (m.permissions ?? []).includes("scan_tickets"),
    );
  }
  return false;
}

export const handleHost: MockHandler = (store, req) => {
  const [head, me, sub, fourth] = req.segments;
  const body = asRecord(req.body);

  /* ----- online check-in (single-accept) ----- */
  if (head === "checkins" && !me && req.method === "POST") {
    const actor = needUser(store, req);
    const code = typeof body.ticketCode === "string" ? body.ticketCode.trim().toUpperCase() : "";
    const ticket = store.ticketsByCode[code];
    if (!code || !ticket) return err(404, "TICKET_INVALID_OR_EXPIRED", "This ticket is invalid or has expired.");
    if (!canScan(store, actor, ticket.eventId)) {
      return err(403, "FORBIDDEN", "You cannot scan tickets for this event.");
    }
    const event = store.events.find((e) => e.id === ticket.eventId);
    if (!event || !["live", "on_sale", "rescheduled"].includes(event.status)) {
      return err(409, "EVENT_NOT_LIVE", "Check-in is not open for this event.");
    }
    if (ticket.status === "checked_in") {
      return err(409, "ALREADY_CHECKED_IN", "This ticket is already checked in.");
    }
    if (ticket.status !== "confirmed" && ticket.status !== "qr_generated") {
      return err(409, "TICKET_INVALID_OR_EXPIRED", "This ticket is invalid or has expired.");
    }
    const now = nowIso();
    ticket.status = "checked_in";
    ticket.checkedInAt = now;
    store.checkins.push({
      ticketCode: code, eventId: ticket.eventId, attendee: ticket.attendee.name, tierName: ticket.tierName,
      status: "checked_in", checkedInAt: now, scannedAt: typeof body.scannedAt === "string" ? body.scannedAt : now,
    });
    return ok({ status: "checked_in", checkedInAt: now });
  }

  /* ----- offline batch sync (first-wins) ----- */
  if (head === "checkins" && me === "sync" && req.method === "POST") {
    const actor = needUser(store, req);
    const scans = Array.isArray(body.scans) ? body.scans.slice(0, 500) : [];
    const seen = new Set<string>();
    const results = scans.map((raw) => {
      const scan = asRecord(raw);
      const code = typeof scan.ticketCode === "string" ? scan.ticketCode.trim().toUpperCase() : "";
      const ticket = store.ticketsByCode[code];
      if (!code || !ticket || !canScan(store, actor, ticket.eventId)) {
        return { ticketCode: code, result: "invalid" as const };
      }
      if (ticket.status === "checked_in" || seen.has(code)) {
        return { ticketCode: code, result: "duplicate" as const };
      }
      if (ticket.status !== "confirmed" && ticket.status !== "qr_generated") {
        return { ticketCode: code, result: "invalid" as const };
      }
      seen.add(code);
      const now = nowIso();
      ticket.status = "checked_in";
      ticket.checkedInAt = now;
      store.checkins.push({
        ticketCode: code, eventId: ticket.eventId, attendee: ticket.attendee.name, tierName: ticket.tierName,
        status: "checked_in", checkedInAt: now, scannedAt: typeof scan.scannedAt === "string" ? scan.scannedAt : now,
      });
      return { ticketCode: code, result: "checked_in" as const, checkedInAt: now };
    });
    return ok({ results });
  }

  if (head !== "hosts" || me !== "me") return null;
  const actor = needUser(store, req);

  if (sub === "events" && req.method === "GET") {
    // Staff see only team-assigned events (BR-016); hosts their own; admin all.
    needRole(actor, ["host", "super_admin", "event_staff"]);
    let list: typeof store.events;
    if (actor.role === "event_staff") {
      const assigned = new Set<string>();
      for (const [eventId, members] of Object.entries(store.team)) {
        if (members.some((m) => (m.userId ?? m.memberId ?? m.user?.id) === actor.id)) assigned.add(eventId);
      }
      list = store.events.filter((e) => assigned.has(e.id));
    } else {
      list = store.events.filter((e) => (actor.role === "super_admin" ? true : store.eventHost[e.id] === actor.id));
    }
    const status = qstr(req.query, "status");
    if (status) list = list.filter((e) => e.status === status);
    list = [...list].sort((a, b) => b.startAt.localeCompare(a.startAt));
    return ok(pageOf(list, req.query, 12));
  }

  needRole(actor, ["host", "super_admin"]);
  const scope = hostScope(store, actor);

  if (sub === "analytics" && fourth === "overview" && req.method === "GET") {
    return ok(store.analytics);
  }

  if (sub === "analytics" && fourth === "top-events" && req.method === "GET") {
    const mine = store.events.filter((e) => store.eventHost[e.id] === scope);
    return ok(
      mine.slice(0, 5).map((e) => ({
        eventId: e.id,
        title: e.title,
        attendees: e.soldCount,
        capacityPct: e.maxAttendees ? Math.round((e.soldCount / e.maxAttendees) * 100) : 0,
        revenue: e.soldCount * e.minPrice,
      })),
    );
  }

  if (sub === "invoices" && !fourth && req.method === "GET") {
    return ok(store.invoicesByHost[scope] ?? []);
  }

  if (sub === "invoices" && fourth && req.method === "GET") {
    const invoice = (store.invoicesByHost[scope] ?? []).find((i) => i.id === fourth);
    if (!invoice) return err(404, "NOT_FOUND", "Invoice not found.");
    return ok(invoice);
  }

  if (sub === "payout-schedule" && req.method === "GET") {
    return ok(store.payoutSchedule[scope] ?? { policy: null, nextEta: null });
  }

  if (sub === "payouts" && req.method === "GET") {
    return ok(store.payouts.filter((p) => p.hostId === scope));
  }

  if (sub === "transactions" && req.method === "GET") {
    let list = store.transactionsByHost[scope] ?? [];
    const type = qstr(req.query, "type");
    if (type) list = list.filter((t) => t.type === type);
    const limit = qnum(req.query, "limit") ?? 20;
    return ok(list.slice(0, limit));
  }

  if (sub === "payout-accounts" && !fourth && req.method === "GET") {
    return ok(store.payoutAccountsByHost[scope] ?? []);
  }

  if (sub === "payout-accounts" && !fourth && req.method === "POST") {
    const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
    const holder = typeof body.holder === "string" ? body.holder.trim() : actor.name;
    const digits = typeof body.accountNumber === "string" ? body.accountNumber.replace(/\D/g, "") : "";
    if (!bankName) return err(400, "VALIDATION_ERROR", "Bank name is required.");
    const account = {
      id: uid(store, "pa"),
      bankName,
      last4: digits.slice(-4).padStart(4, "0"),
      holder,
      method: typeof body.method === "string" ? body.method : "bank",
      status: "pending",
    };
    store.payoutAccountsByHost[scope] = [...(store.payoutAccountsByHost[scope] ?? []), account];
    return created(account);
  }

  if (sub === "payout-accounts" && fourth && req.segments[4] === "disconnect" && req.method === "POST") {
    const account = (store.payoutAccountsByHost[scope] ?? []).find((a) => a.id === fourth);
    if (!account) return err(404, "NOT_FOUND", "Payout account not found.");
    account.status = "disconnected";
    return ok(account);
  }

  if (sub === "payout-accounts" && fourth && req.method === "PATCH") {
    const account = (store.payoutAccountsByHost[scope] ?? []).find((a) => a.id === fourth);
    if (!account) return err(404, "NOT_FOUND", "Payout account not found.");
    if (typeof body.bankName === "string") account.bankName = body.bankName;
    if (typeof body.holder === "string") account.holder = body.holder;
    if (typeof body.method === "string") account.method = body.method;
    return ok(account);
  }

  if (sub === "tax-info" && req.method === "GET") {
    return ok(store.taxInfoByHost[scope] ?? {});
  }

  if (sub === "verification" && req.method === "GET") {
    return ok(store.verificationByHost[scope] ?? {});
  }

  if (sub === "payout-requests" && req.method === "POST") {
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const event = store.events.find((e) => e.id === eventId && store.eventHost[e.id] === scope);
    if (!event) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
    const payout = {
      id: uid(store, "po"),
      eventId,
      hostId: scope,
      netAmount: typeof body.amount === "number" ? Math.round(body.amount) : event.soldCount * event.minPrice,
      status: "pending" as const,
      eta: daysFromNow(6),
      reference: null,
    };
    store.payouts.push(payout);
    return created(payout);
  }

  return null;
};
