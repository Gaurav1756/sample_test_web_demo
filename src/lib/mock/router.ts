/**
 * Sample-backend request router. One dispatch table over the endpoint
 * surface the UI actually calls (see docs/PEGWIN_API_SPEC.md mapping).
 *
 * Both data seams share this: serverApi() via mockFetch, and the BFF
 * /api/* route for browser calls. Handlers live per domain in
 * handlers-*.ts and return null when a route is not theirs.
 */
import type { CursorPage, Page, Role, User } from "../api-types";
import { getMockStore, type MockStore } from "./store";
import { handleAccount } from "./handlers-account";
import { handleAdmin } from "./handlers-admin";
import { handleAuth } from "./handlers-auth";
import { handleCheckout } from "./handlers-checkout";
import { handleContent } from "./handlers-content";
import { handleEvents } from "./handlers-events";
import { handleHost } from "./handlers-host";
import { handleSocial } from "./handlers-social";

export type MockMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MockRequest {
  method: MockMethod;
  /** Decoded path segments, e.g. ["events","evt_001","tiers"]. */
  segments: string[];
  /** First value per query key. */
  query: Record<string, string>;
  authToken?: string;
  body: unknown;
  idempotencyKey?: string;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

export type MockHandler = (
  store: MockStore,
  req: MockRequest,
  user: User | null,
) => MockResponse | null;

/* ---------- responses ---------- */

export function ok(body: unknown, status = 200): MockResponse {
  return { status, body };
}

export function created(body: unknown): MockResponse {
  return { status: 201, body };
}

export function noContent(): MockResponse {
  return { status: 204, body: null };
}

export function err(status: number, code: string, message: string, details?: Record<string, unknown>): MockResponse {
  return { status, body: { error: { code, message, ...(details ? { details } : {}) } } };
}

/** Throwing variant so handlers stay linear; dispatch converts to a response. */
export class MockHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "MockHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function fail(status: number, code: string, message: string, details?: Record<string, unknown>): never {
  throw new MockHttpError(status, code, message, details);
}

/* ---------- auth ---------- */

export function userFromToken(store: MockStore, token: string | undefined): User | null {
  if (!token || !token.startsWith("mock-at-")) return null;
  const userId = token.slice("mock-at-".length).split("-")[0];
  if (store.accessTokens[token] !== userId) return null;
  return store.users.find((u) => u.id === userId) ?? null;
}

/** 401 unless a valid sample session token is present. */
export function needUser(store: MockStore, req: MockRequest): User {
  const user = userFromToken(store, req.authToken);
  if (!user) fail(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}

/** 403 unless the user holds one of the given roles. */
export function needRole(user: User, roles: Role[]): void {
  if (!roles.includes(user.role)) {
    fail(403, "FORBIDDEN", "You do not have permission for this action.");
  }
}

/* ---------- query + envelopes ---------- */

export function qstr(query: Record<string, string>, key: string): string | undefined {
  const v = query[key];
  return v === undefined || v === "" ? undefined : v;
}

export function qnum(query: Record<string, string>, key: string): number | undefined {
  const v = qstr(query, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function pageOf<T>(items: T[], query: Record<string, string>, defaultLimit = 20): Page<T> {
  const page = Math.max(1, qnum(query, "page") ?? 1);
  const limit = Math.min(100, Math.max(1, qnum(query, "limit") ?? defaultLimit));
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit), page, limit, total: items.length };
}

export function cursorOf<T>(items: T[], query: Record<string, string>, defaultLimit = 30): CursorPage<T> {
  const limit = Math.min(100, Math.max(1, qnum(query, "limit") ?? defaultLimit));
  return { data: items.slice(0, limit), nextCursor: null };
}

export function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/* ---------- dispatch ---------- */

const HANDLERS: MockHandler[] = [
  handleAuth,
  handleAccount,
  handleEvents,
  handleCheckout,
  handleSocial,
  handleHost,
  handleAdmin,
  handleContent,
];

export function handleMockRequestOn(store: MockStore, req: MockRequest): MockResponse {
  const user = userFromToken(store, req.authToken);
  try {
    for (const handle of HANDLERS) {
      const res = handle(store, req, user);
      if (res) return res;
    }
    return err(404, "NOT_FOUND", `Sample backend has no ${req.method} /${req.segments.join("/")}.`);
  } catch (e) {
    if (e instanceof MockHttpError) {
      return err(e.status, e.code, e.message, e.details);
    }
    throw e;
  }
}

/** Entry point for both seams (server fetch adapter + BFF route). */
export function handleMockRequest(req: MockRequest): MockResponse {
  return handleMockRequestOn(getMockStore(), req);
}
