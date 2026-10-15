/**
 * Sample community endpoints (§11): discovery, manage hub, text group chat
 * (members text-only, BR-013), posts/likes/comments, joins with the exact
 * warning text, reports, blocks, teams and uploads.
 */
import type { Community, CommunityRole, GroupMessage, User } from "../api-types";
import {
  asRecord,
  created,
  err,
  fail,
  needUser,
  ok,
  pageOf,
  cursorOf,
  qstr,
  type MockHandler,
  type MockRequest,
} from "./router";
import { daysAgo, nowIso, uid, type MockStore } from "./store";
import { JOIN_WARNING } from "./fixtures-social";

/** Communities that require host approval to join (join creates a request). */
const APPROVAL_COMMUNITIES = new Set(["c_comedy"]);

function membershipRole(store: MockStore, communityId: string, user: User | null): CommunityRole | null {
  if (!user) return null;
  if (user.role === "super_admin") return "owner";
  const m = store.memberships.find((x) => x.userId === user.id && x.communityId === communityId && x.state === "member");
  return m?.role ?? null;
}

function needCommunityRole(store: MockStore, req: MockRequest, communityId: string, roles: CommunityRole[]): User {
  const user = needUser(store, req);
  const role = membershipRole(store, communityId, user);
  if (!role || !roles.includes(role)) {
    fail(403, "FORBIDDEN", "Only this community's host team can do that.");
  }
  return user;
}

function communityView(store: MockStore, community: Community, user: User | null): Community {
  const membership = user ? store.memberships.find((m) => m.userId === user.id && m.communityId === community.id) : undefined;
  const blocked = user ? (store.blockedByCommunity[community.id] ?? []).includes(user.id) : false;
  const groups = store.groups[community.id] ?? [];
  const memberBase = groups.reduce((n, g) => Math.max(n, g.memberCount ?? 0), 0);
  const memberCount = memberBase + store.memberships.filter((m) => m.communityId === community.id && m.state === "member").length;
  const upcoming = store.events
    .filter((e) => e.category === community.category && ["published", "on_sale", "live", "rescheduled"].includes(e.status))
    .slice(0, 4);
  const posts = [...(store.posts[community.id] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const topMembers = store.memberships
    .filter((m) => m.communityId === community.id && m.state === "member")
    .slice(0, 4)
    .map((m) => {
      const u = store.users.find((x) => x.id === m.userId);
      return { id: m.userId, name: u?.name ?? m.userId, username: u?.username ?? m.userId, avatarUrl: u?.avatarUrl ?? null };
    });
  return {
    ...community,
    stats: { members: memberCount, eventsHosted: upcoming.length, avgRating: 4.5 },
    topMembers,
    upcoming,
    feed: posts.slice(0, 3),
    membershipState: blocked ? "blocked" : (membership?.state ?? "none"),
    isMuted: user ? store.muted.some((x) => x.userId === user.id && x.communityId === community.id) : false,
    isBlocked: blocked,
    myRole: membership?.role,
  };
}

function groupCommunityId(store: MockStore, groupId: string): string | null {
  return store.groupCommunity[groupId] ?? null;
}

export const handleSocial: MockHandler = (store, req, user) => {
  const [head, id, sub, fourth, fifth] = req.segments;
  const body = asRecord(req.body);

  /* ----- uploads ----- */
  if (head === "uploads" && req.method === "POST") {
    needUser(store, req);
    return created({ uploadUrl: "http://mock.local/uploads", mediaUrl: "/globe.svg", expiresAt: nowIso() });
  }

  /* ----- reports ----- */
  if (head === "reports" && req.method === "POST") {
    const actor = needUser(store, req);
    const communityId = typeof body.communityId === "string" ? body.communityId : "c_tech";
    const community = store.communities.find((c) => c.id === communityId);
    if (!community) return err(404, "NOT_FOUND", "Community not found.");
    const report = {
      id: uid(store, "rep"),
      type: typeof body.targetType === "string" ? body.targetType : "message",
      status: "open" as const,
      reportCount: 1,
      preview: { kind: "message", text: typeof body.reason === "string" ? body.reason.slice(0, 140) : "Reported content" },
      reason: typeof body.reason === "string" ? body.reason : "Reported",
      reporters: [{ id: actor.id, name: actor.name, username: actor.username }],
      createdAt: nowIso(),
    };
    const list = store.communityReports[communityId] ?? [];
    list.unshift(report);
    store.communityReports[communityId] = list;
    store.reportCommunity[report.id] = communityId;
    return created(report);
  }

  /* ----- community discovery ----- */
  if (head === "communities" && !id && req.method === "GET") {
    const search = qstr(req.query, "search")?.toLowerCase();
    let list = store.communities;
    if (user) {
      list = list.filter((c) => !(store.blockedByCommunity[c.id] ?? []).includes(user.id));
    }
    if (search) {
      list = list.filter((c) => `${c.name} ${c.description ?? ""} ${c.category ?? ""}`.toLowerCase().includes(search));
    }
    const page = pageOf(list, req.query, 12);
    return ok({ ...page, data: page.data.map((c) => communityView(store, c, user)) });
  }

  /* ----- create community ----- */
  if (head === "communities" && !id && req.method === "POST") {
    const actor = needUser(store, req);
    if (actor.role !== "host" && actor.role !== "super_admin") {
      return err(403, "FORBIDDEN", "Only hosts can create communities.");
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return err(400, "VALIDATION_ERROR", "A community name is required.");
    const communityId = uid(store, "c");
    const community: Community = {
      id: communityId,
      name,
      description: typeof body.description === "string" ? body.description : null,
      cover: typeof body.cover === "string" ? body.cover : null,
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
      category: typeof body.category === "string" ? body.category : null,
    };
    store.communities.push(community);
    store.communityOwner[communityId] = actor.id;
    const groupId = uid(store, "g");
    store.groups[communityId] = [{ id: groupId, name: "General", description: "Everyday chatter", memberCount: 1 }];
    store.groupCommunity[groupId] = communityId;
    store.messages[groupId] = [];
    store.posts[communityId] = [];
    store.memberships.push({ userId: actor.id, communityId, role: "owner", state: "member" });
    store.communityTeam[communityId] = {
      owner: { id: actor.id, name: actor.name, username: actor.username },
      admins: [],
      moderators: [],
      members: [],
    };
    return created(communityView(store, community, actor));
  }

  /* ----- community detail / update / delete ----- */
  if (head === "communities" && id && !sub) {
    const community = store.communities.find((c) => c.id === id);
    if (!community) return err(404, "NOT_FOUND", "Community not found.");
    if (req.method === "GET") return ok(communityView(store, community, user));
    if (req.method === "PATCH") {
      needCommunityRole(store, req, id, ["owner", "admin"]);
      for (const key of ["name", "description", "category", "cover", "avatarUrl"] as const) {
        if (typeof body[key] === "string") (community[key] as string | null) = body[key] as string;
      }
      return ok(communityView(store, community, user));
    }
    if (req.method === "DELETE") {
      const actor = needUser(store, req);
      const role = membershipRole(store, id, actor);
      if (role !== "owner" && actor.role !== "super_admin") return err(403, "FORBIDDEN", "Only the owner can delete this community.");
      if (qstr(req.query, "confirm") !== "true") return err(400, "VALIDATION_ERROR", "Deletion must be confirmed.");
      store.communities = store.communities.filter((c) => c.id !== id);
      for (const g of store.groups[id] ?? []) {
        delete store.messages[g.id];
        delete store.groupCommunity[g.id];
      }
      delete store.groups[id];
      delete store.posts[id];
      return ok({});
    }
    return null;
  }

  if (head === "communities" && id && sub) {
    const community = store.communities.find((c) => c.id === id);
    if (!community) return err(404, "NOT_FOUND", "Community not found.");

    if (sub === "groups" && req.method === "GET") return ok(store.groups[id] ?? []);

    if (sub === "groups" && req.method === "POST") {
      needCommunityRole(store, req, id, ["owner", "admin"]);
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "New group";
      const group = { id: uid(store, "g"), name, description: typeof body.description === "string" ? body.description : "", memberCount: 1 };
      store.groups[id] = [...(store.groups[id] ?? []), group];
      store.groupCommunity[group.id] = id;
      store.messages[group.id] = [];
      return created(group);
    }

    if (sub === "members" && req.method === "GET") {
      return ok(
        store.memberships
          .filter((m) => m.communityId === id && m.state === "member")
          .map((m) => {
            const u = store.users.find((x) => x.id === m.userId);
            return { id: m.userId, name: u?.name ?? m.userId, username: u?.username ?? m.userId, avatarUrl: u?.avatarUrl ?? null, role: m.role };
          }),
      );
    }

    if (sub === "posts" && req.method === "GET") {
      const posts = [...(store.posts[id] ?? [])]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => ({ ...p, likedByMe: user ? store.likes.some((l) => l.postId === p.id && l.userId === user.id) : false }));
      return ok(cursorOf(posts, req.query));
    }

    if (sub === "posts" && req.method === "POST") {
      const actor = needUser(store, req);
      const role = membershipRole(store, id, actor);
      if (!role) return err(403, "FORBIDDEN", "Join this community to post.");
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return err(400, "VALIDATION_ERROR", "Write something first.");
      const media = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((m): m is string => typeof m === "string") : undefined;
      if (media && media.length > 0 && role === "member") {
        return err(403, "MEDIA_NOT_ALLOWED_FOR_MEMBERS", "Only hosts can share media here.");
      }
      const postItem = {
        id: uid(store, "post"),
        author: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl ?? null },
        text,
        mediaUrls: media,
        likesCount: 0,
        commentsCount: 0,
        status: "published" as const,
        createdAt: nowIso(),
      };
      store.posts[id] = [postItem, ...(store.posts[id] ?? [])];
      store.comments[postItem.id] = [];
      return created(postItem);
    }

    if (sub === "events" && req.method === "GET") {
      return ok(
        store.events.filter((e) => e.category === community.category && ["published", "on_sale", "live", "rescheduled"].includes(e.status)).slice(0, 8),
      );
    }

    if (sub === "join-requests" && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const status = qstr(req.query, "status");
      const list = store.joinRequests[id] ?? [];
      return ok(status ? list.filter((r) => r.status === status) : list);
    }

    if (sub === "join-requests" && fourth && (fifth === "approve" || fifth === "deny") && req.method === "POST") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const item = (store.joinRequests[id] ?? []).find((r) => r.id === fourth);
      if (!item) return err(404, "NOT_FOUND", "Request not found.");
      item.status = fifth === "approve" ? "approved" : "denied";
      if (fifth === "approve" && !store.memberships.some((m) => m.userId === item.user.id && m.communityId === id)) {
        store.memberships.push({ userId: item.user.id, communityId: id, role: "member", state: "member" });
      }
      return ok(item);
    }

    if (sub === "reports" && !fourth && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const status = qstr(req.query, "status");
      const list = store.communityReports[id] ?? [];
      return ok(status ? list.filter((r) => r.status === status) : list);
    }

    if (sub === "reports" && fourth && !fifth && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const report = (store.communityReports[id] ?? []).find((r) => r.id === fourth);
      if (!report) return err(404, "NOT_FOUND", "Report not found.");
      return ok(report);
    }

    if (sub === "reports" && fourth && fifth === "actions" && req.method === "POST") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const report = (store.communityReports[id] ?? []).find((r) => r.id === fourth);
      if (!report) return err(404, "NOT_FOUND", "Report not found.");
      const action = typeof body.action === "string" ? body.action : "dismiss";
      report.status = action === "dismiss" ? "dismissed" : "actioned";
      return ok(report);
    }

    if (sub === "blocked" && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const ids = store.blockedByCommunity[id] ?? [];
      return ok(
        ids.map((userId) => {
          const u = store.users.find((x) => x.id === userId);
          const rec = store.blocked.find((b) => b.userId === userId);
          return { userId, user: u ? { id: u.id, name: u.name, username: u.username } : undefined, blockedAt: rec?.blockedAt ?? daysAgo(1), reason: rec?.reason ?? "Blocked by host" };
        }),
      );
    }

    if (sub === "blocked" && req.method === "POST" && !fourth) {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!store.users.some((u) => u.id === userId)) return err(404, "NOT_FOUND", "User not found.");
      const list = store.blockedByCommunity[id] ?? [];
      if (!list.includes(userId)) list.push(userId);
      store.blockedByCommunity[id] = list;
      store.memberships = store.memberships.filter((m) => !(m.userId === userId && m.communityId === id));
      return created({});
    }

    if (sub === "blocked" && fourth && req.method === "DELETE") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      store.blockedByCommunity[id] = (store.blockedByCommunity[id] ?? []).filter((x) => x !== fourth);
      return ok({});
    }

    if (sub === "team" && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      return ok(store.communityTeam[id] ?? { owner: undefined, admins: [], moderators: [], members: [] });
    }

    if (sub === "team" && req.method === "POST" && !fourth) {
      needCommunityRole(store, req, id, ["owner", "admin"]);
      const userId = typeof body.userId === "string" ? body.userId : "";
      const role = (typeof body.role === "string" ? body.role : "moderator") as CommunityRole;
      const target = store.users.find((u) => u.id === userId);
      if (!target) return err(404, "NOT_FOUND", "User not found.");
      const team = store.communityTeam[id] ?? { admins: [], moderators: [], members: [] };
      const entry = { id: target.id, name: target.name, username: target.username };
      if (role === "admin") team.admins = [...(team.admins ?? []), entry];
      else if (role === "moderator") team.moderators = [...(team.moderators ?? []), entry];
      store.communityTeam[id] = team;
      const membership = store.memberships.find((m) => m.userId === userId && m.communityId === id);
      if (membership) membership.role = role === "admin" || role === "moderator" ? role : membership.role;
      else store.memberships.push({ userId, communityId: id, role: role === "admin" || role === "moderator" ? role : "member", state: "member" });
      return created(team);
    }

    if (sub === "team" && fourth && req.method === "DELETE") {
      needCommunityRole(store, req, id, ["owner", "admin"]);
      const team = store.communityTeam[id];
      if (team) {
        team.admins = (team.admins ?? []).filter((m) => m.id !== fourth);
        team.moderators = (team.moderators ?? []).filter((m) => m.id !== fourth);
      }
      const membership = store.memberships.find((m) => m.userId === fourth && m.communityId === id);
      if (membership) membership.role = "member";
      return ok({});
    }

    if (sub === "data-summary" && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      return ok({
        members: store.memberships.filter((m) => m.communityId === id && m.state === "member").length,
        posts: (store.posts[id] ?? []).length,
        events: store.events.filter((e) => e.category === community.category).length,
        lastUpdatedAt: nowIso(),
      });
    }

    if (sub === "exports" && req.method === "GET") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      return ok(store.exports[id] ?? []);
    }

    if (sub === "exports" && req.method === "POST") {
      needCommunityRole(store, req, id, ["owner", "admin", "moderator"]);
      const type = typeof body.type === "string" ? body.type : "members";
      const job = { id: uid(store, "exp"), exportId: uid(store, "exp"), type, status: "ready" as const, downloadUrl: `/exports/sample-${type}.csv`, createdAt: nowIso() };
      store.exports[id] = [job, ...(store.exports[id] ?? [])];
      return created(job);
    }

    if (sub === "mute" && (req.method === "POST" || req.method === "DELETE")) {
      const actor = needUser(store, req);
      if (req.method === "POST") {
        if (!store.muted.some((x) => x.userId === actor.id && x.communityId === id)) {
          store.muted.push({ userId: actor.id, communityId: id });
        }
      } else {
        store.muted = store.muted.filter((x) => !(x.userId === actor.id && x.communityId === id));
      }
      return ok({ muted: req.method === "POST" });
    }

    if (sub === "transfer-ownership" && req.method === "POST") {
      const actor = needUser(store, req);
      if (store.communityOwner[id] !== actor.id && actor.role !== "super_admin") {
        return err(403, "FORBIDDEN", "Only the owner can transfer ownership.");
      }
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!store.users.some((u) => u.id === userId)) return err(404, "NOT_FOUND", "User not found.");
      store.communityOwner[id] = userId;
      for (const m of store.memberships.filter((m) => m.communityId === id)) {
        if (m.userId === userId) m.role = "owner";
        else if (m.role === "owner") m.role = "admin";
      }
      return ok(communityView(store, community, actor));
    }

    return null;
  }

  /* ----- group chat ----- */
  if (head === "groups" && id && sub === "messages" && !fourth) {
    const communityId = groupCommunityId(store, id);
    if (!communityId) return err(404, "NOT_FOUND", "Group not found.");
    if (req.method === "GET") {
      const items = [...(store.messages[id] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return ok(cursorOf(items, req.query));
    }
    if (req.method === "POST") {
      const actor = needUser(store, req);
      const role = membershipRole(store, communityId, actor);
      if (!role) return err(403, "FORBIDDEN", "Join this community to chat.");
      const type = (typeof body.type === "string" ? body.type : "text") as GroupMessage["type"];
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (type !== "text" && role === "member") {
        return err(403, "MEDIA_NOT_ALLOWED_FOR_MEMBERS", "Only hosts can share media here.");
      }
      if (!text && type === "text") return err(400, "VALIDATION_ERROR", "Write a message first.");
      const msg: GroupMessage = {
        id: uid(store, "msg"),
        groupId: id,
        author: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl ?? null },
        type,
        text,
        createdAt: nowIso(),
      };
      store.messages[id] = [...(store.messages[id] ?? []), msg];
      return created(msg);
    }
    return null;
  }

  if (head === "groups" && id && sub === "messages" && fourth && req.method === "DELETE") {
    const communityId = groupCommunityId(store, id);
    if (!communityId) return err(404, "NOT_FOUND", "Group not found.");
    needCommunityRole(store, req, communityId, ["owner", "admin", "moderator"]);
    store.messages[id] = (store.messages[id] ?? []).filter((m) => m.id !== fourth);
    return ok({});
  }

  if (head === "groups" && id && (sub === "join" || sub === "leave") && req.method === "POST") {
    const actor = needUser(store, req);
    const communityId = groupCommunityId(store, id);
    if (!communityId) return err(404, "NOT_FOUND", "Group not found.");
    if (sub === "leave") {
      store.memberships = store.memberships.filter((m) => !(m.userId === actor.id && m.communityId === communityId));
      return ok({});
    }
    if (APPROVAL_COMMUNITIES.has(communityId) && !store.memberships.some((m) => m.userId === actor.id && m.communityId === communityId)) {
      const pending = (store.joinRequests[communityId] ?? []).some((r) => r.user.id === actor.id && r.status === "pending");
      if (!pending) {
        store.joinRequests[communityId] = [
          { id: uid(store, "jr"), user: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl ?? null }, status: "pending", createdAt: nowIso() },
          ...(store.joinRequests[communityId] ?? []),
        ];
      }
      return err(403, "JOIN_REQUIRES_APPROVAL", "This group requires approval to join.");
    }
    if (!store.memberships.some((m) => m.userId === actor.id && m.communityId === communityId)) {
      store.memberships.push({ userId: actor.id, communityId, role: "member", state: "member" });
    }
    return ok({ memberId: actor.id, communityWarning: JOIN_WARNING });
  }

  if (head === "groups" && id && sub === "members" && req.method === "GET") {
    const communityId = groupCommunityId(store, id);
    if (!communityId) return err(404, "NOT_FOUND", "Group not found.");
    return ok(
      store.memberships
        .filter((m) => m.communityId === communityId && m.state === "member")
        .map((m) => {
          const u = store.users.find((x) => x.id === m.userId);
          return { id: m.userId, name: u?.name ?? m.userId, username: u?.username ?? m.userId, role: m.role };
        }),
    );
  }

  if (head === "groups" && id && sub === "members" && fourth && req.method === "DELETE") {
    const communityId = groupCommunityId(store, id);
    if (!communityId) return err(404, "NOT_FOUND", "Group not found.");
    needCommunityRole(store, req, communityId, ["owner", "admin", "moderator"]);
    store.memberships = store.memberships.filter((m) => !(m.userId === fourth && m.communityId === communityId));
    return ok({});
  }

  /* ----- post likes + comments ----- */
  if (head === "posts" && id && sub === "likes" && (req.method === "POST" || req.method === "DELETE")) {
    const actor = needUser(store, req);
    const found = findPost(store, id);
    if (!found) return err(404, "NOT_FOUND", "Post not found.");
    if (req.method === "POST") {
      if (!store.likes.some((l) => l.postId === id && l.userId === actor.id)) {
        store.likes.push({ postId: id, userId: actor.id });
        found.likesCount += 1;
      }
    } else {
      store.likes = store.likes.filter((l) => !(l.postId === id && l.userId === actor.id));
      found.likesCount = Math.max(0, found.likesCount - 1);
    }
    return ok({ likesCount: found.likesCount, likedByMe: req.method === "POST" });
  }

  if (head === "posts" && id && sub === "comments" && req.method === "GET") {
    if (!findPost(store, id)) return err(404, "NOT_FOUND", "Post not found.");
    return ok(cursorOf(store.comments[id] ?? [], req.query));
  }

  if (head === "posts" && id && sub === "comments" && req.method === "POST") {
    const actor = needUser(store, req);
    const found = findPost(store, id);
    if (!found) return err(404, "NOT_FOUND", "Post not found.");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return err(400, "VALIDATION_ERROR", "Write a comment first.");
    const comment = { id: uid(store, "cmt"), author: { id: actor.id, name: actor.name }, text, createdAt: nowIso() };
    store.comments[id] = [...(store.comments[id] ?? []), comment];
    found.commentsCount += 1;
    return created(comment);
  }

  return null;
};

function findPost(store: MockStore, postId: string) {
  for (const posts of Object.values(store.posts)) {
    const found = posts.find((p) => p.id === postId);
    if (found) return found;
  }
  return null;
}
