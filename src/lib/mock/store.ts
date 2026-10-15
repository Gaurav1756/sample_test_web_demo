/**
 * In-memory sample backend store. One process-wide singleton seeded with
 * deterministic fixtures; mutations apply to it so the whole site behaves
 * like a real backend (holds, orders, tickets, chat, approvals…).
 *
 * Lifetime: per server process. A dev-server restart reseeds from scratch —
 * that reset is intentional (deterministic sample accounts and fixtures).
 * Tests use resetMockStore() for isolation.
 *
 * Only the data seams (serverApi/publicApi/BFF route) may touch this module.
 * UI code must never import from lib/mock (see tests/mock-boundary.test.ts).
 */
import type {
  AdminCoupon,
  AnalyticsOverview,
  AuditLog,
  BlockedMember,
  Community,
  CommunityGroup,
  CommunityReport,
  CommunityRole,
  CommunityTeam,
  ContentPage,
  DataSummary,
  EventDetail,
  ExportJob,
  GroupMessage,
  HelpArticle,
  HostVerification,
  Invoice,
  JoinRequest,
  LedgerTransaction,
  MembershipState,
  NotificationItem,
  NotificationPreferences,
  Order,
  Payout,
  PayoutAccount,
  PayoutSchedule,
  Post,
  Refund,
  SupportConversation,
  SupportMessage,
  TaxInfo,
  Ticket,
  Tier,
  TeamMember,
  User,
} from "../api-types";
import { seedEvents } from "./fixtures-events";
import { seedSocial } from "./fixtures-social";
import { seedMisc } from "./fixtures-misc";

export interface MockComment {
  id: string;
  author: { id: string; name: string };
  text: string;
  createdAt: string;
}

export interface MockHold {
  holdId: string;
  userId: string;
  eventId: string;
  items: Array<{ tierId: string; qty: number }>;
  expiresAt: string;
  status: "active" | "released" | "consumed";
}

export interface MockOrderRec {
  order: Order;
  userId: string;
  eventId: string;
  holdId?: string;
  couponCode?: string;
}

export interface MockPaymentRec {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  gateway: string;
  gatewayOrderId: string;
  status: "pending" | "success" | "failed" | "refunded";
  attempts: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface MockTicketRec extends Ticket {
  eventId: string;
  orderId: string;
}

export interface MockCheckin {
  ticketCode: string;
  eventId: string;
  attendee: string;
  tierName: string;
  status: string;
  checkedInAt: string | null;
  scannedAt: string | null;
}

export interface MockMembership {
  userId: string;
  communityId: string;
  role: CommunityRole;
  state: MembershipState;
}

export interface MockStore {
  users: User[];
  passwords: Record<string, string>;
  contactIndex: Record<string, string>;
  pendingOtps: Record<string, string>;
  accessTokens: Record<string, string>;
  refreshTokens: Record<string, string>;
  events: EventDetail[];
  eventHost: Record<string, string>;
  tiers: Record<string, Tier[]>;
  team: Record<string, TeamMember[]>;
  ratings: Record<string, { sum: number; count: number }>;
  holds: MockHold[];
  orders: MockOrderRec[];
  orderTickets: Record<string, MockTicketRec[]>;
  ticketsByCode: Record<string, MockTicketRec>;
  payments: MockPaymentRec[];
  refunds: Record<string, Refund[]>;
  checkins: MockCheckin[];
  idempotency: Record<string, unknown>;
  communities: Community[];
  communityOwner: Record<string, string>;
  groups: Record<string, CommunityGroup[]>;
  groupCommunity: Record<string, string>;
  messages: Record<string, GroupMessage[]>;
  memberships: MockMembership[];
  muted: Array<{ userId: string; communityId: string }>;
  blocked: BlockedMember[];
  blockedByCommunity: Record<string, string[]>;
  posts: Record<string, Post[]>;
  comments: Record<string, MockComment[]>;
  likes: Array<{ postId: string; userId: string }>;
  joinRequests: Record<string, JoinRequest[]>;
  communityReports: Record<string, CommunityReport[]>;
  reportCommunity: Record<string, string>;
  communityTeam: Record<string, CommunityTeam>;
  exports: Record<string, ExportJob[]>;
  coupons: AdminCoupon[];
  notifications: Record<string, NotificationItem[]>;
  notifPrefs: Record<string, NotificationPreferences>;
  savedEvents: Array<{ userId: string; eventId: string }>;
  savedCommunities: Array<{ userId: string; communityId: string }>;
  helpArticles: HelpArticle[];
  contentPages: Record<string, ContentPage>;
  supportTopics: string[];
  supportConvos: SupportConversation[];
  supportOwner: Record<string, string>;
  supportMessages: Record<string, SupportMessage[]>;
  payoutSchedule: Record<string, PayoutSchedule>;
  payouts: Payout[];
  transactionsByHost: Record<string, LedgerTransaction[]>;
  payoutAccountsByHost: Record<string, PayoutAccount[]>;
  invoicesByHost: Record<string, Invoice[]>;
  taxInfoByHost: Record<string, TaxInfo>;
  verificationByHost: Record<string, HostVerification>;
  auditLog: AuditLog[];
  flaggedExtra: Record<string, { cancelledEvents: number; violations: Array<{ type: string; createdAt: string }>; status: string }>;
  analytics: AnalyticsOverview;
  dataSummaries: Record<string, DataSummary>;
  seq: Record<string, number>;
}

/* ---------- deterministic id / time helpers ---------- */

export function nextSeq(store: MockStore, key: string): number {
  store.seq[key] = (store.seq[key] ?? 0) + 1;
  return store.seq[key];
}

export function uid(store: MockStore, prefix: string): string {
  return `${prefix}_${String(nextSeq(store, prefix)).padStart(3, "0")}`;
}

/** 12-char uppercase ticket code (matches the scanner's validation). */
export function ticketCode(store: MockStore): string {
  const n = nextSeq(store, "ticket").toString(36).toUpperCase().padStart(9, "0");
  return `PGW${n}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/* ---------- seed + singleton ---------- */

function emptyStore(): MockStore {
  return {
    users: [],
    passwords: {},
    contactIndex: {},
    pendingOtps: {},
    accessTokens: {},
    refreshTokens: {},
    events: [],
    eventHost: {},
    tiers: {},
    team: {},
    ratings: {},
    holds: [],
    orders: [],
    orderTickets: {},
    ticketsByCode: {},
    payments: [],
    refunds: {},
    checkins: [],
    idempotency: {},
    communities: [],
    communityOwner: {},
    groups: {},
    groupCommunity: {},
    messages: {},
    memberships: [],
    muted: [],
    blocked: [],
    blockedByCommunity: {},
    posts: {},
    comments: {},
    likes: [],
    joinRequests: {},
    communityReports: {},
    reportCommunity: {},
    communityTeam: {},
    exports: {},
    coupons: [],
    notifications: {},
    notifPrefs: {},
    savedEvents: [],
    savedCommunities: [],
    helpArticles: [],
    contentPages: {},
    supportTopics: [],
    supportConvos: [],
    supportOwner: {},
    supportMessages: {},
    payoutSchedule: {},
    payouts: [],
    transactionsByHost: {},
    payoutAccountsByHost: {},
    invoicesByHost: {},
    taxInfoByHost: {},
    verificationByHost: {},
    auditLog: [],
    flaggedExtra: {},
    analytics: {
      members: { total: 0, new: 0, deltaPct: 0 },
      eventsHosted: 0,
      funnel: { views: 0, saved: 0, purchases: 0, attendees: 0 },
      audience: { newMembers: 0, returningPct: 0, avgEventsPerAttendee: 0, topInterests: [] },
      engagement: { activePct: 0, posts: 0, comments: 0, discussions: 0 },
      revenue: { total: 0, deltaPct: 0, ticketsSold: 0, avgTicketValue: 0 },
      insights: [],
    },
    dataSummaries: {},
    seq: {},
  };
}

export function seedStore(): MockStore {
  const store = emptyStore();
  seedEvents(store);
  seedSocial(store);
  seedMisc(store);
  return store;
}

let singleton: MockStore | null = null;

/** Process-wide sample backend state. */
export function getMockStore(): MockStore {
  if (!singleton) singleton = seedStore();
  return singleton;
}

/** Reseed from scratch (tests; dev reset). */
export function resetMockStore(): MockStore {
  singleton = seedStore();
  return singleton;
}
