/**
 * Typed contracts for the Pegwin backend REST API.
 *
 * Source: docs/PEGWIN_API_SPEC.md (v1.0 MVP baseline) as mapped in
 * docs/analysis/api-integration-map.md. No fields are invented here:
 * shapes marked TBD in the spec are typed as `unknown`-ish records or
 * explicitly flagged, and extended only when the backend confirms them.
 *
 * Conventions (§1/§1a): ULID ids, integer paise for money, ISO-8601 UTC
 * timestamps, E.164 phones, page/limit envelopes, cursor feeds.
 */

/** Backend roles (§1). Never trust a client-supplied role. */
export type Role = "user" | "host" | "event_staff" | "super_admin";

/** Standard page/limit envelope (§1a). */
export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/** Cursor feed envelope for messages/posts/comments (§1a). */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

/** Error body (§1a, §14). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** OTP purposes (§2). */
export type OtpPurpose = "register" | "login" | "reset";

/** POST /auth/register → 201 */
export interface RegisterResponse {
  userId: string;
  otpRequired: true;
}

/** POST /auth/otp/request, /auth/otp/resend → 200 */
export interface OtpResponse {
  expiresInSec: number;
}

/** Token pair + user returned by verify/login/refresh (§2). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** POST /auth/login → 202 when the account requires OTP. */
export interface LoginOtpRequired {
  otpRequired: true;
}

export type LoginResponse = AuthTokens | LoginOtpRequired;

export function loginRequiresOtp(res: LoginResponse): res is LoginOtpRequired {
  return (res as LoginOtpRequired).otpRequired === true;
}

/**
 * Tolerate both a bare array and a page envelope for list endpoints whose
 * exact shape is unconfirmed (CQ-08/24). Documented envelopes are preferred
 * wherever the spec is explicit.
 */
export function toList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  const data = (body as Page<T> | null)?.data;
  if (Array.isArray(data)) return data;
  const items = (body as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

/** User object (§3a). */
export interface User {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  role: Role;
  interests?: string[];
  city?: string | null;
  country?: string | null;
  socialLinks?: Record<string, string>;
  locale?: string | null;
  visibility?: UserVisibility;
  createdAt: string;
}

/** PATCH /users/me/visibility (§3). Extra keys beyond profileVisible are
 *  unconfirmed (CQ-02); additional keys are tolerated, not typed. */
export interface UserVisibility {
  profileVisible?: boolean;
  [key: string]: unknown;
}

/** POST /uploads → signed upload URLs (§11a). */
export interface UploadResponse {
  uploadUrl: string;
  mediaUrl: string;
  expiresAt: string;
}

/** Minimal public profile (§3). */
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
}

/** Event lifecycle statuses (BRD §8, API §5). */
export type EventStatus =
  | "draft"
  | "review"
  | "published"
  | "on_sale"
  | "live"
  | "completed"
  | "cancelled"
  | "rescheduled";

/** Event discovery card (§4). */
export interface EventCard {
  id: string;
  title: string;
  coverImage?: string | null;
  category?: string | null;
  city?: string | null;
  venue?: string | null;
  startAt: string;
  endAt: string;
  status: EventStatus;
  /** Lowest tier price in paise. */
  minPrice: number;
  soldCount: number;
  goingCount: number;
  avgRating?: number | null;
  isSaved?: boolean;
}

/** Event detail (§4). */
export interface EventDetail extends EventCard {
  description: string;
  language?: string | null;
  targetAudience?: string | null;
  maxAttendees?: number | null;
  agenda?: AgendaSlot[];
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tiers?: Tier[];
  policies?: {
    refundPolicy?: string | null;
    entryRules?: string | null;
    ageRestriction?: string | null;
  };
  host?: PublicHost;
  community?: CommunityLink;
  going?: number;
  attended?: number;
  sold?: number;
}

export interface AgendaSlot {
  time: string;
  title: string;
}

/** GET /events/:eventId/attendees (§4). */
export interface AttendeesResponse {
  attendees: PublicUser[];
  goingCount: number;
}

export interface PublicHost {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  eventsHostedCount?: number;
  avgRating?: number | null;
  communities?: Array<{ id: string; name: string }>;
}

export interface CommunityLink {
  id: string;
  name: string;
  avatarUrl?: string | null;
  membershipState?: MembershipState;
}

/** Ticket tier (§6). Money in paise. */
export interface Tier {
  id: string;
  name: string;
  price: number;
  capacity: number;
  soldCount: number;
  availableCount: number;
}

/** Who absorbs a coupon discount (§6). Value decided by client (CQ-12). */
export type DiscountBearer = "host" | "pegwin" | "split";

/** POST /checkout/quote → 200 (§6). All money in paise, server-computed. */
export interface QuoteItem {
  tierId: string;
  qty: number;
  hostPrice: number;
  platformFee: number;
  displayPrice: number;
}

export interface QuoteTotals {
  hostPrice: number;
  platformFee: number;
  displayPrice: number;
  discount: number;
  discountBearer?: DiscountBearer;
  taxableAmount: number;
  gst: number;
  finalPayable: number;
}

export interface Quote {
  items: QuoteItem[];
  totals: QuoteTotals;
}

/** POST /checkout/holds → 201 (§6). */
export interface Hold {
  holdId: string;
  expiresAt: string;
  status?: string;
}

/** POST /checkout/coupons/validate → 200 (§6). */
export interface CouponValidation {
  valid: boolean;
  /** Discount in paise. */
  discount: number;
  reason?: string;
}

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "refunded";

/** Order detail (§7). */
export interface Order {
  id: string;
  eventId: string;
  items: Array<{
    tierId: string;
    tierName: string;
    qty: number;
    unitPrice: number;
  }>;
  amounts: QuoteTotals;
  status: OrderStatus;
  payment?: unknown;
  createdAt: string;
}

export type TicketStatus =
  | "pending"
  | "confirmed"
  | "qr_generated"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "refunded"
  | "expired";

/** Digital ticket (§7). */
export interface Ticket {
  ticketCode: string;
  qrPayload: string;
  attendee: { name: string; phone?: string; email?: string };
  tierName: string;
  verified: boolean;
  status: TicketStatus;
  checkedInAt?: string | null;
  event: {
    id: string;
    title: string;
    startAt: string;
    venue?: string | null;
    address?: string | null;
  };
}

/** POST /orders/:id/cancel → 200 (§7). */
export interface OrderCancellation {
  status: "cancelled";
  refundAmount: number;
  refundId?: string;
}

/** GET /orders/:id/receipt → 200 (§7). */
export interface Receipt {
  receiptUrl: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
}

export type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "refunded"
  | "partially_refunded";

/**
 * Payment object (§8). TBD draft — the backend has not finalized §8
 * (CQ-14). Fields below mirror the draft proposal only.
 */
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  gateway: string;
  status: PaymentStatus;
  attempts?: number;
  createdAt: string;
  confirmedAt?: string | null;
}

/**
 * POST /payments/intents (§8). TBD draft (CQ-14); mirrors the proposal.
 */
export interface PaymentIntent {
  paymentId: string;
  gateway: string;
  gatewayOrderId: string;
  checkoutPayload: unknown;
}

export type RefundStatus = "pending" | "processed" | "failed";

/**
 * Refund record (§8). POST returns { refundId, status }; the GET list item
 * shape is unstated, so every field is tolerated.
 */
export interface Refund {
  refundId?: string;
  id?: string;
  status?: string;
  amount?: number;
  reason?: string | null;
  createdAt?: string;
}

export type PayoutStatus = "pending" | "processing" | "paid" | "failed";

/**
 * Payout object (§9). TBD draft (CQ-15). Fields mirror the draft proposal.
 */
export interface Payout {
  id: string;
  eventId: string;
  hostId: string;
  netAmount: number;
  discountBearerShare?: number;
  status: PayoutStatus;
  eta?: string | null;
  reference?: string | null;
}

/** POST /checkins → 200 (§10). */
export interface CheckinResult {
  status: "checked_in";
  checkedInAt: string;
}

/** POST /checkins/sync → 200 (§10). */
export interface CheckinSyncResult {
  results: Array<{
    ticketCode: string;
    result: "checked_in" | "duplicate" | "invalid";
    checkedInAt?: string;
  }>;
}

/** Offline validation bundle (§10). */
export interface ValidationData {
  eventId: string;
  generatedAt: string;
  tickets: Array<{
    ticketCode: string;
    qrHash: string;
    tierId: string;
    attendee: string;
  }>;
  eventWindow: { startAt: string; endAt: string };
}

export type MembershipState = "none" | "member" | "pending" | "blocked";
export type CommunityRole = "owner" | "admin" | "moderator" | "member";

/** Community detail (§11). */
export interface Community {
  id: string;
  name: string;
  description?: string | null;
  cover?: string | null;
  avatarUrl?: string | null;
  category?: string | null;
  stats?: { members: number; eventsHosted: number; avgRating?: number | null };
  topMembers?: PublicUser[];
  upcoming?: EventCard[];
  feed?: Post[];
  membershipState?: MembershipState;
  isMuted?: boolean;
  isBlocked?: boolean;
  myRole?: CommunityRole;
}

/**
 * Community group (§11). The groups list item shape is not fully specified;
 * only id is relied upon, the rest is optional and tolerated.
 */
export interface CommunityGroup {
  id: string;
  name?: string;
  description?: string;
  memberCount?: number;
}

/** POST /groups/:id/join → 200 (§11). The warning must be shown. */
export interface JoinResult {
  memberId: string;
  communityWarning?: string;
}

/** Group message (§11). */
export interface GroupMessage {
  id: string;
  groupId: string;
  author: { id: string; name: string; avatarUrl?: string | null };
  type: "text" | "image" | "video" | "file" | "announcement";
  text?: string;
  mediaUrl?: string;
  createdAt: string;
}

/** Community post (§11i). */
export interface Post {
  id: string;
  author: { id: string; name: string; avatarUrl?: string | null };
  text: string;
  mediaUrls?: string[];
  likesCount: number;
  commentsCount: number;
  likedByMe?: boolean;
  status: "published" | "held" | "removed";
  createdAt: string;
}

export type ReportStatus = "open" | "actioned" | "dismissed";

/** Host report queue item (§11e). */
export interface CommunityReport {
  id: string;
  type: string;
  status: ReportStatus;
  reportCount: number;
  preview?: { kind: string; text?: string; author?: string };
  reason: string;
  reporters: Array<{ id: string; name: string; username: string }>;
  createdAt: string;
}

/** Notification (§12). */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  refType?: string;
  refId?: string;
  readAt?: string | null;
  createdAt: string;
}

/** Notification preferences (§12). */
export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  upcomingReminders: boolean;
  eventUpdates: boolean;
  ticketUpdates: boolean;
  savedActivity: boolean;
  communityActivity: boolean;
  communityEvents: boolean;
  mentionsReplies: boolean;
  recommendedEvents: boolean;
  nearbyEvents: boolean;
}

/** Host analytics overview (§12b). */
export interface AnalyticsOverview {
  members: { total: number; new: number; deltaPct: number };
  eventsHosted: number;
  funnel: { views: number; saved: number; purchases: number; attendees: number };
  audience: {
    newMembers: number;
    returningPct: number;
    avgEventsPerAttendee: number;
    topInterests: string[];
  };
  engagement: {
    activePct: number;
    posts: number;
    comments: number;
    discussions: number;
  };
  revenue: {
    total: number;
    deltaPct: number;
    ticketsSold: number;
    avgTicketValue: number;
  };
  insights: Array<{ title: string; text: string }>;
}

/** Admin review queue is a list of event cards pending review (§13). */
export type ReviewQueueItem = EventCard;

/**
 * Event team member (§5). The GET item shape is unstated (CQ-08); only
 * identity + permissions are relied upon, the rest is tolerated.
 */
export interface TeamMember {
  id?: string;
  memberId?: string;
  userId?: string;
  user?: PublicUser;
  permissions?: string[];
  status?: string;
}

export type TeamPermission = "manage_event" | "scan_tickets";

/**
 * Check-in monitor row (§5/§10). Item shape unstated (CQ-08); tolerated.
 */
export interface CheckinRecord {
  ticketCode?: string;
  attendee?: string;
  tierName?: string;
  status?: string;
  checkedInAt?: string | null;
  scannedAt?: string | null;
}

/** Community join request (§11d). */
export interface JoinRequest {
  id: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  status: "pending" | "approved" | "denied";
  createdAt: string;
}

/** Blocked member entry (§11f). Shape tolerated. */
export interface BlockedMember {
  userId?: string;
  user?: PublicUser;
  blockedAt?: string;
  reason?: string;
}

/** Community team roster (§11c). Grouped shape tolerated. */
export interface CommunityTeam {
  owner?: PublicUser;
  admins?: PublicUser[];
  moderators?: PublicUser[];
  members?: Array<{ memberId: string; user: PublicUser; role: string }>;
}

/** Community data summary (§11h). */
export interface DataSummary {
  members: number;
  posts: number;
  events: number;
  lastUpdatedAt: string;
}

/** Data export job (§11h). */
export interface ExportJob {
  exportId?: string;
  id?: string;
  type?: string;
  status: "queued" | "ready" | "failed";
  downloadUrl?: string;
  createdAt?: string;
}

/** Host verification status (§9a/§13c). TBD draft; mirrors the proposal. */
export interface HostVerification {
  identity?: { status: string; name?: string; verifiedAt?: string };
  payoutAccount?: { status: string; bankName?: string; last4?: string; holder?: string };
  hosting?: { freeEvents?: number; paidEvents?: number; communityHosting?: boolean };
}

/** Payout schedule (§9). TBD draft (CQ-15). */
export interface PayoutSchedule {
  policy?: string;
  nextEta?: string | null;
}

/** Ledger transaction (§9). TBD draft (CQ-15). */
export interface LedgerTransaction {
  id: string;
  type: string;
  eventId?: string;
  amount: number;
  label: string;
  createdAt: string;
}

/** Payout account (§9a). TBD draft (CQ-15). */
export interface PayoutAccount {
  id: string;
  bankName: string;
  last4: string;
  holder: string;
  method?: string;
  status: string;
}

/** Invoice (§9a). TBD draft (CQ-15). */
export interface Invoice {
  id: string;
  eventId?: string;
  amount: number;
  downloadUrl: string;
  issuedAt: string;
}

/**
 * Tax profile (GET /hosts/me/tax-info). Field set is TBD (§16), so the
 * shape is never read speculatively — the UI renders returned scalars only.
 */
export type TaxInfo = Record<string, unknown>;

/** Top-event analytics row (§12b). */
export interface TopEventRow {
  eventId: string;
  title: string;
  attendees: number;
  capacityPct: number;
  revenue: number;
}

/** Audit log entry (§13). */
export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

/** Admin coupon (§6). */
export interface AdminCoupon {
  id: string;
  code: string;
  discountType: "flat" | "pct";
  value: number;
  eventId?: string | null;
  tierId?: string | null;
  maxUses?: number | null;
  usedCount?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  discountBearer?: DiscountBearer | null;
  status?: string | null;
}

/**
 * Flagged host (§13). Item shape unstated; identity + counts tolerated.
 */
export interface FlaggedHost {
  hostId?: string;
  id?: string;
  user?: PublicUser;
  name?: string;
  cancelledCount?: number;
  cancelledEvents?: number;
  violations?: Array<{ type: string; createdAt: string }>;
  status?: string;
}

/** Support conversation (§13a). List pagination/shape partly TBD (CQ-20). */
export interface SupportConversation {
  id: string;
  topic: string;
  status: "open" | "closed";
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  author: { id: string; name: string };
  text: string;
  createdAt: string;
}

/** Help article (§13a). */
export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  body: string;
  updatedAt: string;
}

/** Policy content page (§13a). */
export interface ContentPage {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
}
