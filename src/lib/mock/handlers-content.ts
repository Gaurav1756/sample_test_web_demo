/**
 * Sample meta, help, policy-content, support and public-host endpoints.
 * Read-mostly; support threads accept new conversations and replies.
 */
import {
  asRecord,
  created,
  cursorOf,
  err,
  needUser,
  ok,
  qstr,
  type MockHandler,
} from "./router";
import { nowIso, uid } from "./store";
import { META } from "./fixtures-misc";

export const handleContent: MockHandler = (store, req) => {
  const [head, second, third] = req.segments;
  const body = asRecord(req.body);

  if (head === "meta" && req.method === "GET") {
    if (second === "categories") return ok(META.categories);
    if (second === "interests") return ok(META.interests);
    if (second === "cities") return ok(META.cities);
    if (second === "languages") return ok(META.languages);
    return null;
  }

  if (head === "help" && second === "articles" && !third && req.method === "GET") {
    const category = qstr(req.query, "category");
    const search = qstr(req.query, "search")?.toLowerCase();
    let list = store.helpArticles;
    if (category) list = list.filter((a) => a.category === category);
    if (search) list = list.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(search));
    return ok(list);
  }

  if (head === "help" && second === "articles" && third && req.method === "GET") {
    const article = store.helpArticles.find((a) => a.id === third);
    if (!article) return err(404, "NOT_FOUND", "Article not found.");
    return ok(article);
  }

  if (head === "content" && second && req.method === "GET") {
    const page = store.contentPages[second];
    if (!page) return err(404, "NOT_FOUND", "Page not found.");
    return ok(page);
  }

  if (head === "support" && second === "topics" && req.method === "GET") {
    return ok(store.supportTopics);
  }

  if (head === "support" && second === "conversations" && !third && req.method === "GET") {
    const actor = needUser(store, req);
    const mine = actor.role === "super_admin"
      ? store.supportConvos
      : store.supportConvos.filter((c) => store.supportOwner[c.id] === actor.id);
    return ok(mine);
  }

  if (head === "support" && second === "conversations" && !third && req.method === "POST") {
    const actor = needUser(store, req);
    const topic = typeof body.topic === "string" && body.topic ? body.topic : "General";
    const convo = { id: uid(store, "sup"), topic, status: "open" as const, updatedAt: nowIso() };
    store.supportConvos.unshift(convo);
    store.supportOwner[convo.id] = actor.id;
    const first = typeof body.message === "string" ? body.message.trim() : "";
    store.supportMessages[convo.id] = first
      ? [{ id: uid(store, "smsg"), author: { id: actor.id, name: actor.name }, text: first, createdAt: nowIso() }]
      : [];
    return created(convo);
  }

  if (head === "support" && second === "conversations" && third && req.segments[3] === "messages" && req.method === "GET") {
    const actor = needUser(store, req);
    const convo = store.supportConvos.find((c) => c.id === third);
    if (!convo) return err(404, "NOT_FOUND", "Conversation not found.");
    if (store.supportOwner[third] !== actor.id && actor.role !== "super_admin") {
      return err(403, "FORBIDDEN", "You do not have permission for this action.");
    }
    return ok(cursorOf(store.supportMessages[third] ?? [], req.query));
  }

  if (head === "support" && second === "conversations" && third && req.segments[3] === "messages" && req.method === "POST") {
    const actor = needUser(store, req);
    const convo = store.supportConvos.find((c) => c.id === third);
    if (!convo) return err(404, "NOT_FOUND", "Conversation not found.");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return err(400, "VALIDATION_ERROR", "Write a message first.");
    const msg = { id: uid(store, "smsg"), author: { id: actor.id, name: actor.name }, text, createdAt: nowIso() };
    store.supportMessages[third] = [...(store.supportMessages[third] ?? []), msg];
    convo.updatedAt = nowIso();
    return created(msg);
  }

  if (head === "hosts" && second && req.method === "GET") {
    const host = store.users.find((u) => u.id === second && (u.role === "host" || u.role === "super_admin"));
    if (!host) return err(404, "NOT_FOUND", "Host not found.");
    const hosted = store.events.filter((e) => store.eventHost[e.id] === host.id);
    const communities = Object.entries(store.communityOwner)
      .filter(([, ownerId]) => ownerId === host.id)
      .map(([id]) => store.communities.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ id: c.id, name: c.name }));
    return ok({
      id: host.id,
      name: host.name,
      avatarUrl: host.avatarUrl ?? null,
      bio: host.bio ?? `${host.name} hosts local events on Pegwin Circle.`,
      eventsHostedCount: hosted.length,
      avgRating: 4.6,
      communities,
    });
  }

  return null;
};
