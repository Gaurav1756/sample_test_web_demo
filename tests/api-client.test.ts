import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api-errors";
import { createApiClient, type TokenStore } from "../src/lib/api-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function memoryStore(access = "access-1", refresh = "refresh-1"): TokenStore & { saved: Array<{ accessToken: string; refreshToken: string }>; cleared: number } {
  const saved: Array<{ accessToken: string; refreshToken: string }> = [];
  let cleared = 0;
  return {
    saved,
    get cleared() {
      return cleared;
    },
    getAccessToken: () => (saved.length ? saved[saved.length - 1].accessToken : access),
    getRefreshToken: () => (saved.length ? saved[saved.length - 1].refreshToken : refresh),
    save: (t) => {
      saved.push(t);
    },
    clear: () => {
      cleared += 1;
    },
  };
}

describe("api client", () => {
  it("attaches Bearer tokens and returns parsed JSON", async () => {
    const seen: Request[] = [];
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      seen.push(new Request(url as string, init));
      return jsonResponse(200, { data: [1] });
    });
    const api = createApiClient({
      baseUrl: "https://api.example.test/v1",
      tokens: memoryStore(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await api.get<{ data: number[] }>("events", { query: { limit: 20 } });
    expect(res).toEqual({ data: [1] });
    expect(seen[0].url).toBe("https://api.example.test/v1/events?limit=20");
    expect(seen[0].headers.get("authorization")).toBe("Bearer access-1");
  });

  it("skips auth for public requests", async () => {
    let auth: string | null = "unset";
    const fetchImpl = vi.fn(async (_url: unknown, _init?: RequestInit) => {
      void _url;
      void _init;
      return jsonResponse(200, { ok: true });
    });
    const api = createApiClient({
      baseUrl: "https://api.example.test/v1",
      tokens: memoryStore(),
      fetchImpl: (async (url: unknown, init?: RequestInit) => {
        auth = new Request(url as string, init).headers.get("authorization");
        return fetchImpl(url, init);
      }) as unknown as typeof fetch,
    });
    await api.get("meta/categories", { auth: false });
    expect(auth).toBeNull();
  });

  it("throws ApiError with backend code/status on error bodies", async () => {
    const api = createApiClient({
      baseUrl: "https://api.example.test/v1",
      fetchImpl: (async () =>
        jsonResponse(409, { error: { code: "ALREADY_CHECKED_IN", message: "Dup." } })) as unknown as typeof fetch,
    });
    const caught: unknown = await api.post("checkins", {}).catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.status).toBe(409);
    expect(err.code).toBe("ALREADY_CHECKED_IN");
  });

  it("refreshes once on 401 and retries with the rotated token", async () => {
    const authHeaders: Array<string | null> = [];
    let calls = 0;
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      const req = new Request(url as string, init);
      if (req.url.endsWith("/auth/refresh")) {
        calls += 1;
        return jsonResponse(200, { accessToken: "access-2", refreshToken: "refresh-2", user: {} });
      }
      authHeaders.push(req.headers.get("authorization"));
      if (req.headers.get("authorization") === "Bearer access-1") {
        return jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Expired." } });
      }
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const store = memoryStore();
    const api = createApiClient({ baseUrl: "https://api.example.test/v1", tokens: store, fetchImpl });
    await api.get("users/me");
    expect(calls).toBe(1);
    expect(authHeaders).toEqual(["Bearer access-1", "Bearer access-2"]);
    expect(store.saved).toEqual([{ accessToken: "access-2", refreshToken: "refresh-2" }]);
  });

  it("single-flights concurrent 401 refreshes", async () => {
    let refreshCalls = 0;
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      const req = new Request(url as string, init);
      if (req.url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return jsonResponse(200, { accessToken: "access-2", refreshToken: "refresh-2", user: {} });
      }
      if (req.headers.get("authorization") === "Bearer access-1") {
        return jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Expired." } });
      }
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const api = createApiClient({
      baseUrl: "https://api.example.test/v1",
      tokens: memoryStore(),
      fetchImpl,
    });
    await Promise.all([api.get("a"), api.get("b"), api.get("c")]);
    expect(refreshCalls).toBe(1);
  });

  it("clears the session when refresh fails", async () => {
    const fetchImpl = (async (url: unknown) =>
      String(url).endsWith("/auth/refresh")
        ? jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Bad refresh." } })
        : jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "Expired." } })) as unknown as typeof fetch;
    const store = memoryStore();
    const api = createApiClient({ baseUrl: "https://api.example.test/v1", tokens: store, fetchImpl });
    await expect(api.get("users/me")).rejects.toBeInstanceOf(ApiError);
    expect(store.cleared).toBe(1);
  });

  it("forwards Idempotency-Key for mutating operations", async () => {
    let key: string | null = null;
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      key = new Request(url as string, init).headers.get("idempotency-key");
      return jsonResponse(201, { orderId: "o1" });
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "https://api.example.test/v1", fetchImpl });
    await api.post("orders", { holdId: "h1" }, { idempotencyKey: "key-123" });
    expect(key).toBe("key-123");
  });

  it("maps network failure to BACKEND_UNREACHABLE", async () => {
    const api = createApiClient({
      baseUrl: "https://api.example.test/v1",
      fetchImpl: (async () => {
        throw new Error("fetch failed");
      }) as unknown as typeof fetch,
    });
    const err = (await api.get("events").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("BACKEND_UNREACHABLE");
    expect(err.status).toBe(502);
  });
});
