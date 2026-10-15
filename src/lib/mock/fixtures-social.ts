/**
 * Sample communities, groups, messages, posts, reports and teams.
 * Per-user fields (membership state, likes, mute) are computed at read time
 * in the handlers so mutations stay consistent.
 */
import type { Community, CommunityGroup, GroupMessage, Post } from "../api-types";
import { daysAgo, hoursFromNow, uid, type MockStore } from "./store";

const WARNING =
  "Please do not use abusive, offensive, or inappropriate language. Respect all community members.";

export const JOIN_WARNING = WARNING;

function community(
  id: string,
  name: string,
  description: string,
  category: string,
): Community {
  return { id, name, description, cover: null, avatarUrl: null, category };
}

function group(id: string, name: string, description: string, memberCount: number): CommunityGroup {
  return { id, name, description, memberCount };
}

let msgSeq = 0;
function message(
  store: MockStore,
  groupId: string,
  userId: string,
  type: GroupMessage["type"],
  text: string,
  hoursAgo: number,
): GroupMessage {
  const user = store.users.find((u) => u.id === userId);
  msgSeq += 1;
  return {
    id: `msg_${groupId}_${String(msgSeq).padStart(2, "0")}`,
    groupId,
    author: { id: userId, name: user?.name ?? userId, avatarUrl: null },
    type,
    text,
    createdAt: hoursFromNow(-hoursAgo),
  };
}

function post(
  store: MockStore,
  authorId: string,
  text: string,
  daysAgoN: number,
  media?: string[],
): Post {
  const user = store.users.find((u) => u.id === authorId);
  return {
    id: uid(store, "post"),
    author: { id: authorId, name: user?.name ?? authorId, avatarUrl: null },
    text,
    mediaUrls: media,
    likesCount: 0,
    commentsCount: 0,
    status: "published",
    createdAt: daysAgo(daysAgoN),
  };
}

export function seedSocial(store: MockStore): void {
  store.communities = [
    community("c_tech", "Bengaluru Tech Meetups", "Talks, hack nights and demo days for builders in Bengaluru.", "Tech"),
    community("c_music", "Mumbai Live Music", "Gig alerts, artist AMAs and fan meetups across Mumbai.", "Music"),
    community("c_comedy", "Delhi Comedy Club", "Open mics, improv jams and comedy writing circles.", "Comedy"),
    community("c_food", "Chennai Food Explorers", "Food walks, cook-offs and restaurant hunts.", "Food"),
  ];
  store.communityOwner = { c_tech: "u_host", c_music: "u_host", c_comedy: "u_host2", c_food: "u_host3" };

  store.groups = {
    c_tech: [
      group("g_tech_general", "General", "Everyday chatter", 128),
      group("g_tech_ann", "Announcements", "Host announcements only", 132),
    ],
    c_music: [group("g_music_general", "General", "Everyday chatter", 214)],
    c_comedy: [group("g_comedy_general", "General", "Everyday chatter", 96)],
    c_food: [group("g_food_general", "General", "Everyday chatter", 74)],
  };
  for (const [communityId, groups] of Object.entries(store.groups)) {
    for (const g of groups) store.groupCommunity[g.id] = communityId;
  }

  store.memberships = [
    { userId: "u_host", communityId: "c_tech", role: "owner", state: "member" },
    { userId: "u_m1", communityId: "c_tech", role: "admin", state: "member" },
    { userId: "u_attendee", communityId: "c_tech", role: "member", state: "member" },
    { userId: "u_m2", communityId: "c_tech", role: "member", state: "member" },
    { userId: "u_host", communityId: "c_music", role: "owner", state: "member" },
    { userId: "u_attendee", communityId: "c_music", role: "member", state: "member" },
    { userId: "u_m2", communityId: "c_music", role: "moderator", state: "member" },
    { userId: "u_host2", communityId: "c_comedy", role: "owner", state: "member" },
    { userId: "u_m4", communityId: "c_comedy", role: "member", state: "member" },
    { userId: "u_host3", communityId: "c_food", role: "owner", state: "member" },
    { userId: "u_m3", communityId: "c_food", role: "member", state: "member" },
  ];

  store.messages = {
    g_tech_general: [
      message(store, "g_tech_general", "u_host", "text", "Welcome to the new season of demo days! First one is next Friday.", 50),
      message(store, "g_tech_general", "u_m1", "text", "I'll bring the projector this time.", 49),
      message(store, "g_tech_general", "u_attendee", "text", "Can first-timers pitch too?", 48),
      message(store, "g_tech_general", "u_host", "text", "Absolutely — 3-minute lightning slots are open to everyone.", 47),
      message(store, "g_tech_general", "u_m2", "text", "Sharing my notes from last week's Rust talk in the files thread.", 30),
      message(store, "g_tech_general", "u_m1", "text", "Reminder: RSVP for the mixer closes tomorrow evening.", 9),
      message(store, "g_tech_general", "u_attendee", "text", "Done! See you all there.", 8),
    ],
    g_tech_ann: [
      message(store, "g_tech_ann", "u_host", "announcement", "November demo day is confirmed for the 21st. Slot bookings open Monday.", 26),
    ],
    g_music_general: [
      message(store, "g_music_general", "u_host", "text", "Set times for Saturday are out — doors at 6, first act at 7.", 20),
      message(store, "g_music_general", "u_m2", "text", "Merch stall confirmed near the entrance.", 19),
      message(store, "g_music_general", "u_attendee", "text", "Is parking available at the venue?", 18),
      message(store, "g_music_general", "u_host", "text", "Limited — please carpool or take the metro to Andheri.", 17),
    ],
    g_comedy_general: [
      message(store, "g_comedy_general", "u_host2", "text", "Open mic slots for Sunday are live. Five minutes each.", 12),
      message(store, "g_comedy_general", "u_m4", "text", "Signed up! First time performing, wish me luck.", 11),
    ],
    g_food_general: [
      message(store, "g_food_general", "u_host3", "text", "This weekend's walk covers 6 Mylapore legends. Meeting at 7 AM.", 15),
      message(store, "g_food_general", "u_m3", "text", "Bringing two friends along!", 14),
    ],
  };

  const techPosts = [
    post(store, "u_host", "Demo day photos are up! Tag yourselves. Next edition: bigger stage.", 6),
    post(store, "u_m1", "My notes on edge rendering — feedback welcome before I turn this into a talk.", 3),
    post(store, "u_attendee", "First demo day done. What a crowd! Thanks for the warm welcome.", 1),
  ];
  const musicPosts = [
    post(store, "u_host", "Saturday's headliner soundcheck video. Turn it up!", 2),
    post(store, "u_m2", "Setlist predictions thread — what are they opening with?", 1),
  ];
  store.posts = { c_tech: techPosts, c_music: musicPosts, c_comedy: [], c_food: [] };
  for (const posts of Object.values(store.posts)) {
    for (const p of posts) store.comments[p.id] = [];
  }
  store.comments[techPosts[0].id] = [
    { id: uid(store, "cmt"), author: { id: "u_m1", name: "Divya Iyer" }, text: "Great shots!", createdAt: daysAgo(5) },
    { id: uid(store, "cmt"), author: { id: "u_attendee", name: "Aarav Sharma" }, text: "Found myself in the third one.", createdAt: daysAgo(5) },
  ];
  techPosts[0].commentsCount = 2;
  techPosts[0].likesCount = 14;
  techPosts[1].likesCount = 9;
  techPosts[2].likesCount = 21;
  musicPosts[0].likesCount = 32;
  musicPosts[1].likesCount = 6;
  store.likes = [
    { postId: techPosts[2].id, userId: "u_m1" },
    { postId: musicPosts[0].id, userId: "u_attendee" },
  ];

  store.joinRequests = {
    c_comedy: [
      { id: uid(store, "jr"), user: { id: "u_m3", name: "Sneha Reddy", avatarUrl: null }, status: "pending", createdAt: daysAgo(1) },
    ],
    c_food: [
      { id: uid(store, "jr"), user: { id: "u_m2", name: "Arjun Patel", avatarUrl: null }, status: "pending", createdAt: daysAgo(2) },
    ],
  };

  const report1 = {
    id: uid(store, "rep"),
    type: "message",
    status: "open" as const,
    reportCount: 2,
    preview: { kind: "message", text: "Spam link posted in General", author: "Vikram Singh" },
    reason: "Spam",
    reporters: [
      { id: "u_m1", name: "Divya Iyer", username: "divya" },
      { id: "u_attendee", name: "Aarav Sharma", username: "aarav" },
    ],
    createdAt: daysAgo(1),
  };
  store.communityReports = { c_tech: [report1], c_comedy: [], c_music: [], c_food: [] };
  store.reportCommunity = { [report1.id]: "c_tech" };

  store.communityTeam = {
    c_tech: {
      owner: { id: "u_host", name: "Meera Nair", username: "meera.hosts" },
      admins: [{ id: "u_m1", name: "Divya Iyer", username: "divya" }],
      moderators: [],
      members: [
        { memberId: "u_attendee", user: { id: "u_attendee", name: "Aarav Sharma", username: "aarav" }, role: "member" },
        { memberId: "u_m2", user: { id: "u_m2", name: "Arjun Patel", username: "arjun" }, role: "member" },
      ],
    },
    c_music: {
      owner: { id: "u_host", name: "Meera Nair", username: "meera.hosts" },
      admins: [],
      moderators: [{ id: "u_m2", name: "Arjun Patel", username: "arjun" }],
      members: [
        { memberId: "u_attendee", user: { id: "u_attendee", name: "Aarav Sharma", username: "aarav" }, role: "member" },
      ],
    },
    c_comedy: {
      owner: { id: "u_host2", name: "Kabir Malhotra", username: "kabir.events" },
      admins: [],
      moderators: [],
      members: [
        { memberId: "u_m4", user: { id: "u_m4", name: "Vikram Singh", username: "vikram" }, role: "member" },
      ],
    },
    c_food: {
      owner: { id: "u_host3", name: "Zoya Khan", username: "zoya.eats" },
      admins: [],
      moderators: [],
      members: [
        { memberId: "u_m3", user: { id: "u_m3", name: "Sneha Reddy", username: "sneha" }, role: "member" },
      ],
    },
  };

  store.blockedByCommunity = { c_food: ["u_m4"] };
  store.blocked = [
    { userId: "u_m4", user: { id: "u_m4", name: "Vikram Singh", username: "vikram" }, blockedAt: daysAgo(3), reason: "Repeated spam" },
  ];

  store.muted = [{ userId: "u_attendee", communityId: "c_food" }];
  store.exports = {};
}
