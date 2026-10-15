/**
 * fetch() adapter over the sample backend. Plugged into createApiClient as
 * fetchImpl when PEGWIN_DATA_SOURCE=mock, so server components and server
 * actions run unchanged against sample data.
 *
 * Accepts the same (input, init) shapes the client sends: string/URL/Request
 * inputs with JSON bodies, Bearer [REDACTED] and idempotency keys.
 */
import { handleMockRequest, type MockMethod } from "./router";

function readInput(input: string | URL | Request): { url: string; headers: Headers; method: string } {
  if (typeof input === "string") return { url: input, headers: new Headers(), method: "GET" };
  if (input instanceof URL) return { url: input.toString(), headers: new Headers(), method: "GET" };
  return { url: input.url, headers: new Headers(input.headers), method: input.method };
}

export async function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const { url, headers: inputHeaders, method: inputMethod } = readInput(input);
  const headers = new Headers(init?.headers ?? inputHeaders);
  // Merge Request-object headers when init carries none (defensive; the
  // client always passes init explicitly).
  if (!init?.headers) {
    inputHeaders.forEach((value, key) => {
      if (!headers.has(key)) headers.set(key, value);
    });
  }
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    if (!(key in query)) query[key] = value;
  });
  const method = ((init?.method ?? inputMethod ?? "GET").toUpperCase()) as MockMethod;
  let body: unknown;
  const raw = init?.body;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = raw;
    }
  }
  const authorization = headers.get("authorization") ?? "";
  const result = handleMockRequest({
    method,
    segments,
    query,
    authToken: authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined,
    body,
    idempotencyKey: headers.get("idempotency-key") ?? undefined,
  });
  if (result.status === 204 || result.body === null || result.body === undefined) {
    return new Response(null, { status: result.status });
  }
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
}
