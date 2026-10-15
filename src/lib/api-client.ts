/**
 * Centralized, typed client for the Pegwin backend REST API.
 *
 * Exact documented endpoints/verbs/fields only (see api-types.ts). Backend
 * responses are authoritative: this client never invents data and surfaces
 * backend errors as ApiError with §14 codes.
 *
 * Pure module: no Next.js or React imports, so it is unit-testable with
 * stubbed fetch. Server code wires cookies via TokenStore; browser code
 * calls the same-origin BFF (/api/*) instead of using this directly.
 */
import { ApiError } from "./api-errors";
import type { ApiErrorBody, AuthTokens } from "./api-types";

export interface TokenStore {
  getAccessToken(): string | undefined;
  getRefreshToken(): string | undefined;
  save(tokens: { accessToken: string; refreshToken: string }): void | Promise<void>;
  clear(): void | Promise<void>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-serializable body. */
  body?: unknown;
  /** Skip attaching the Bearer token (public endpoints). */
  auth?: boolean;
  /** Explicit token override (rare; prefer the store). */
  token?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Idempotency-Key header value for POST /orders, /payments/intents,
   * /checkins and /checkins/sync retries (§1). Callers must reuse the same
   * key across retries of one logical operation.
   */
  idempotencyKey?: string;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens?: TokenStore;
  fetchImpl?: typeof fetch;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const err = (body as ApiErrorBody | null)?.error;
  return new ApiError(
    status,
    typeof err?.code === "string" ? err.code : "UNKNOWN",
    typeof err?.message === "string" ? err.message : `Request failed with status ${status}.`,
    typeof err?.details === "object" && err?.details !== null
      ? (err.details as Record<string, unknown>)
      : undefined,
  );
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, tokens } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  /** Single-flight refresh shared by concurrent 401s. */
  let refreshPromise: Promise<boolean> | null = null;

  async function doFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(url, init);
    } catch {
      throw new ApiError(502, "BACKEND_UNREACHABLE", "The Pegwin service is unreachable right now.");
    }
  }

  async function refresh(): Promise<boolean> {
    if (!tokens) return false;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = tokens.getRefreshToken();
        if (!refreshToken) return false;
        const res = await doFetch(buildUrl(baseUrl, "auth/refresh"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const body = await parseBody(res);
        if (!res.ok) {
          await tokens.clear();
          return false;
        }
        const pair = body as AuthTokens;
        await tokens.save({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
        return true;
      })().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

    const withAuth = opts.auth !== false;
    const send = async (token: string | undefined): Promise<Response> =>
      doFetch(buildUrl(baseUrl, path, opts.query), {
        method: opts.method ?? "GET",
        headers: token && withAuth ? { ...headers, authorization: `Bearer ${token}` } : headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });

    let res = await send(opts.token ?? tokens?.getAccessToken());

    if (res.status === 401 && withAuth && !opts.token && tokens?.getRefreshToken()) {
      const refreshed = await refresh();
      if (refreshed) {
        res = await send(tokens.getAccessToken());
      } else {
        const body = await parseBody(res);
        throw toApiError(res.status, body);
      }
    }

    const body = await parseBody(res);
    if (!res.ok) throw toApiError(res.status, body);
    return body as T;
  }

  return {
    request,
    get: <T,>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...opts, method: "GET" }),
    post: <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...opts, method: "POST", body }),
    put: <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...opts, method: "PUT", body }),
    patch: <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...opts, method: "PATCH", body }),
    delete: <T,>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...opts, method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Generate an Idempotency-Key for one logical mutating operation. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
