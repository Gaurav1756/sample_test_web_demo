/**
 * Sample account endpoints (§3, §12): profile, visibility, notification
 * preferences, notification inbox, saved items, blocked communities and
 * public profiles.
 */
import type { NotificationPreferences } from "../api-types";
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
import { nowIso, type MockStore } from "./store";

function prefsFor(store: MockStore, userId: string): NotificationPreferences {
  const prefs = store.notifPrefs[userId];
  if (prefs) return prefs;
  const fresh: NotificationPreferences = {
    push: true, email: true, upcomingReminders: true, eventUpdates: true, ticketUpdates: true,
    savedActivity: true, communityActivity: true, communityEvents: true, mentionsReplies: true,
    recommendedEvents: false, nearbyEvents: false,
  };
  store.notifPrefs[userId] = fresh;
  return fresh;
}

const RANGE_DAYS: Record<string, number> = { this_week: 7, last_month: 30, "3_months": 90, "1_year": 365 };

export const handleAccount: MockHandler = (store, req) => {
  if (req.segments[0] !== "users") return null;
  const [, second, third, fourth] = req.segments;
  const body = asRecord(req.body);

  if (second === "username-available" && req.method === "GET") {
    const username = (qstr(req.query, "username") ?? "").toLowerCase();
    const taken = store.users.some((u) => u.username.toLowerCase() === username);
    return ok({ available: username.length >= 3 && !taken });
  }

  if (second === "me" && req.segments.length === 2) {
    if (req.method === "GET") return ok(needUser(store, req));
    if (req.method === "PATCH") {
      const user = needUser(store, req);
      const patch = (key: "name" | "username" | "bio" | "city" | "avatarUrl" | "locale") => {
        if (typeof body[key] === "string") (user[key] as string | null) = body[key] as string;
      };
      patch("name"); patch("username"); patch("bio"); patch("city"); patch("avatarUrl"); patch("locale");
      if (Array.isArray(body.interests)) user.interests = body.interests.filter((i): i is string => typeof i === "string");
      return ok(user);
    }
    if (req.method === "DELETE") {
      const user = needUser(store, req);
      if (qstr(req.query, "confirm") !== "true") {
        return err(400, "VALIDATION_ERROR", "Deletion must be confirmed.");
      }
      store.users = store.users.filter((u) => u.id !== user.id);
      for (const [token, id] of Object.entries(store.accessTokens)) {
        if (id === user.id) delete store.accessTokens[token];
      }
      for (const [token, id] of Object.entries(store.refreshTokens)) {
        if (id === user.id) delete store.refreshTokens[token];
      }
      for (const [contact, id] of Object.entries(store.contactIndex)) {
        if (id === user.id) delete store.contactIndex[contact];
      }
      return ok({});
    }
    return null;
  }

  if (second === "me" && third === "visibility" && req.method === "PATCH") {
    const user = needUser(store, req);
    user.visibility = { ...(user.visibility ?? {}), profileVisible: body.profileVisible === true };
    return ok(user.visibility);
  }

  if (second === "me" && third === "notification-preferences") {
    const user = needUser(store, req);
    if (req.method === "GET") return ok(prefsFor(store, user.id));
    if (req.method === "PATCH") {
      const prefs = prefsFor(store, user.id);
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "boolean" && key in prefs) {
          (prefs as unknown as Record<string, boolean>)[key] = value;
        }
      }
      return ok(prefs);
    }
    return null;
  }

  if (second === "me" && third === "notifications" && !fourth) {
    const user = needUser(store, req);
    if (req.method !== "GET") return null;
    const items = [...(store.notifications[user.id] ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return ok(pageOf(items, req.query));
  }

  if (second === "me" && third === "notifications" && fourth === "read-all" && req.method === "POST") {
    const user = needUser(store, req);
    const now = nowIso();
    for (const n of store.notifications[user.id] ?? []) n.readAt = n.readAt ?? now;
    return ok({ updated: (store.notifications[user.id] ?? []).length });
  }

  if (second === "me" && third === "notifications" && req.segments[4] === "read" && req.method === "PATCH") {
    const user = needUser(store, req);
    const item = (store.notifications[user.id] ?? []).find((n) => n.id === fourth);
    if (!item) return err(404, "NOT_FOUND", "Notification not found.");
    item.readAt = nowIso();
    return ok(item);
  }

  if (second === "me" && third === "events" && req.method === "GET") {
    const user = needUser(store, req);
    const filter = qstr(req.query, "filter") ?? "attended";
    const rangeDays = RANGE_DAYS[qstr(req.query, "range") ?? ""] ?? null;
    const now = Date.now();
    const inRange = (startAt: string) =>
      rangeDays === null || now - new Date(startAt).getTime() <= rangeDays * 86400000;
    const myOrderEvents = [...new Set(store.orders.filter((o) => o.userId === user.id).map((o) => o.eventId))];
    const myCheckinEvents = [...new Set(store.checkins.filter((c) => c.status === "checked_in" && Object.values(store.ticketsByCode).some((t) => t.ticketCode === c.ticketCode && store.orders.some((o) => o.order.id === t.orderId && o.userId === user.id))).map((c) => c.eventId))];
    const hosted = store.events.filter((e) => store.eventHost[e.id] === user.id);
    const byId = (id: string) => store.events.find((e) => e.id === id);
    let list: typeof store.events = [];
    if (filter === "hosted") list = hosted;
    else if (filter === "booked") list = myOrderEvents.map(byId).filter((e): e is (typeof store.events)[number] => Boolean(e));
    else if (filter === "past") {
      const candidates = [...myOrderEvents.map(byId), ...hosted];
      list = candidates.filter(
        (e): e is (typeof store.events)[number] => e !== undefined && new Date(e.endAt).getTime() < now,
      );
    } else {
      const attendedIds = new Set([...myCheckinEvents]);
      for (const e of myOrderEvents.map(byId)) {
        if (e && new Date(e.endAt).getTime() < now) attendedIds.add(e.id);
      }
      list = [...attendedIds].map(byId).filter((e): e is (typeof store.events)[number] => Boolean(e));
    }
    return ok(list.filter((e) => inRange(e.startAt)));
  }

  if (second === "me" && (third === "saved-events" || third === "saved-communities")) {
    const user = needUser(store, req);
    const isEvents = third === "saved-events";
    if (req.method === "GET" && !fourth) {
      if (isEvents) {
        return ok(store.savedEvents.filter((s) => s.userId === user.id).map((s) => store.events.find((e) => e.id === s.eventId)).filter(Boolean));
      }
      return ok(store.savedCommunities.filter((s) => s.userId === user.id).map((s) => store.communities.find((c) => c.id === s.communityId)).filter(Boolean));
    }
    if (req.method === "POST" && !fourth) {
      const id = typeof body.eventId === "string" ? body.eventId : typeof body.communityId === "string" ? body.communityId : typeof body.id === "string" ? body.id : "";
      if (!id) return err(400, "VALIDATION_ERROR", "Nothing to save.");
      if (isEvents) {
        if (!store.events.some((e) => e.id === id)) return err(404, "EVENT_NOT_FOUND", "This event is unavailable.");
        if (!store.savedEvents.some((s) => s.userId === user.id && s.eventId === id)) {
          store.savedEvents.push({ userId: user.id, eventId: id });
        }
      } else {
        if (!store.communities.some((c) => c.id === id)) return err(404, "NOT_FOUND", "Community not found.");
        if (!store.savedCommunities.some((s) => s.userId === user.id && s.communityId === id)) {
          store.savedCommunities.push({ userId: user.id, communityId: id });
        }
      }
      return created({});
    }
    if (req.method === "DELETE" && fourth) {
      if (isEvents) store.savedEvents = store.savedEvents.filter((s) => !(s.userId === user.id && s.eventId === fourth));
      else store.savedCommunities = store.savedCommunities.filter((s) => !(s.userId === user.id && s.communityId === fourth));
      return ok({});
    }
    return null;
  }

  if (second === "me" && third === "blocked-communities") {
    const user = needUser(store, req);
    if (req.method === "GET" && !fourth) {
      const mine = Object.entries(store.blockedByCommunity).filter(([, ids]) => ids.includes(user.id)).map(([id]) => id);
      return ok(mine.map((id) => store.communities.find((c) => c.id === id)).filter(Boolean));
    }
    if (req.method === "POST" && !fourth) {
      const id = typeof body.communityId === "string" ? body.communityId : "";
      if (!store.communities.some((c) => c.id === id)) return err(404, "NOT_FOUND", "Community not found.");
      const list = store.blockedByCommunity[id] ?? [];
      if (!list.includes(user.id)) list.push(user.id);
      store.blockedByCommunity[id] = list;
      return created({});
    }
    if (req.method === "DELETE" && fourth) {
      store.blockedByCommunity[fourth] = (store.blockedByCommunity[fourth] ?? []).filter((id) => id !== user.id);
      return ok({});
    }
    return null;
  }

  if (second === "me" && third === "communities" && req.method === "GET") {
    const user = needUser(store, req);
    const mine = store.memberships.filter((m) => m.userId === user.id && m.state === "member").map((m) => m.communityId);
    return ok(mine.map((id) => store.communities.find((c) => c.id === id)).filter(Boolean));
  }

  if (req.method === "GET" && req.segments.length === 3 && third === "public") {
    const user = store.users.find((u) => u.id === second);
    if (!user) return err(404, "NOT_FOUND", "User not found.");
    return ok({ id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl ?? null });
  }

  return null;
};

export function notify(store: MockStore, userId: string, note: { type: string; title: string; body: string; refType?: string; refId?: string }): void {
  const list = store.notifications[userId] ?? [];
  list.unshift({
    id: `ntf_${Date.now().toString(36)}_${list.length}`,
    type: note.type,
    title: note.title,
    body: note.body,
    refType: note.refType,
    refId: note.refType ? note.refId : undefined,
    readAt: null,
    createdAt: nowIso(),
  });
  store.notifications[userId] = list;
}
