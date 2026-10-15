/**
 * Browser-safe caller for the same-origin BFF (/api/* → backend).
 * Session cookies travel automatically; tokens stay server-side.
 * Backend errors surface as ApiError with §14 codes.
 */
import { ApiError } from "./api-errors";

export interface BffOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function bff<T>(path: string, opts: BffOptions = {}): Promise<T> {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`/api/${clean}`, window.location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(502, "BACKEND_UNREACHABLE", "The Pegwin service is unreachable right now.");
  }
  if (res.status === 204) return null as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
    throw new ApiError(
      res.status,
      typeof err?.code === "string" ? err.code : "UNKNOWN",
      typeof err?.message === "string" ? err.message : `Request failed with status ${res.status}.`,
      typeof err?.details === "object" && err?.details !== null
        ? (err.details as Record<string, unknown>)
        : undefined,
    );
  }
  return data as T;
}
