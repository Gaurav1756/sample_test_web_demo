import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/lib/api-client";
import { MOCK_BASE_URL } from "../src/lib/data-source";
import { mockFetch } from "../src/lib/mock/mock-fetch";
import { handleMockRequestOn, type MockRequest, type MockResponse } from "../src/lib/mock/router";
import { seedStore, type MockStore } from "../src/lib/mock/store";
import type { AuthTokens, User } from "../src/lib/api-types";

function call(
  store: MockStore,
  method: MockRequest["method"],
  path: string,
  opts: { body?: unknown; token?: string; key?: string } = {},
): MockResponse {
  const [p, qs] = path.split("?");
  const query: Record<string, string> = {};
  if (qs) {
    for (const part of qs.split("&")) {
      const [k, v] = part.split("=");
      if (k && !(k in query)) query[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  }
  return handleMockRequestOn(store, {
    method,
    segments: p.split("/").filter(Boolean),
    query,
    authToken: opts.token,
    body: opts.body,
    idempotencyKey: opts.key,
  });
}

function login(store: MockStore, email: string, password = "demo1234"): AuthTokens {
  const res = call(store, "POST", "auth/login", { body: { email, password } });
  expect(res.status).toBe(200);
  return res.body as AuthTokens;
}

describe("mock auth", () => {
  it("signs in each demo account with its role", () => {
    const store = seedStore();
    const cases: Array<[string, User["role"]]> = [
      ["attendee@pegwin.in", "user"],
      ["host@pegwin.in", "host"],
      ["staff@pegwin.in", "event_staff"],
      ["admin@pegwin.in", "super_admin"],
    ];
    for (const [email, role] of cases) {
      const tokens = login(store, email);
      expect(tokens.user.role).toBe(role);
      expect(tokens.accessToken).toMatch(/^mock-at-/);
    }
  });

  it("rejects wrong passwords without leaking which half failed", () => {
    const store = seedStore();
    const res = call(store, "POST", "auth/login", { body: { email: "attendee@pegwin.in", password: "nope" } });
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("INVALID_CREDENTIALS");
  });

  it("runs the OTP loop with the documented demo code", () => {
    const store = seedStore();
    const requested = call(store, "POST", "auth/otp/request", { body: { email: "attendee@pegwin.in", purpose: "login" } });
    expect(requested.status).toBe(200);
    const bad = call(store, "POST", "auth/otp/verify", { body: { email: "attendee@pegwin.in", otp: "000000", purpose: "login" } });
    expect(bad.status).toBe(400);
    const good = call(store, "POST", "auth/otp/verify", { body: { email: "attendee@pegwin.in", otp: "123456", purpose: "login" } });
    expect(good.status).toBe(200);
    expect((good.body as AuthTokens).user.email).toBe("attendee@pegwin.in");
  });

  it("registers a new user and activates on OTP verify", () => {
    const store = seedStore();
    const reg = call(store, "POST", "auth/register", { body: { name: "Test User", email: "new@example.com", password: "demo1234" } });
    expect(reg.status).toBe(201);
    expect((reg.body as { otpRequired: boolean }).otpRequired).toBe(true);
    const verify = call(store, "POST", "auth/otp/verify", { body: { email: "new@example.com", otp: "123456", purpose: "register" } });
    expect(verify.status).toBe(200);
    expect((verify.body as AuthTokens).user.role).toBe("user");
  });

  it("serves users/me from the session token and 401s without one", () => {
    const store = seedStore();
    const tokens = login(store, "host@pegwin.in");
    const me = call(store, "GET", "users/me", { token: tokens.accessToken });
    expect(me.status).toBe(200);
    expect((me.body as User).email).toBe("host@pegwin.in");
    const anon = call(store, "GET", "users/me");
    expect(anon.status).toBe(401);
  });

  it("rotates refresh tokens (single use)", () => {
    const store = seedStore();
    const tokens = login(store, "attendee@pegwin.in");
    const rotated = call(store, "POST", "auth/refresh", { body: { refreshToken: tokens.refreshToken } });
    expect(rotated.status).toBe(200);
    expect((rotated.body as AuthTokens).accessToken).not.toBe(tokens.accessToken);
    const replay = call(store, "POST", "auth/refresh", { body: { refreshToken: tokens.refreshToken } });
    expect(replay.status).toBe(401);
  });

  it("updates passwords through the reset flow", () => {
    const store = seedStore();
    expect(call(store, "POST", "auth/password/forgot", { body: { email: "attendee@pegwin.in" } }).status).toBe(200);
    const reset = call(store, "POST", "auth/password/reset", {
      body: { email: "attendee@pegwin.in", otp: "123456", newPassword: "newpass123" },
    });
    expect(reset.status).toBe(200);
    login(store, "attendee@pegwin.in", "newpass123");
  });

  it("drives the real ApiClient through mockFetch unchanged", async () => {
    const api = createApiClient({ baseUrl: MOCK_BASE_URL, fetchImpl: mockFetch as unknown as typeof fetch });
    const cats = await api.get<string[]>("meta/categories", { auth: false });
    expect(cats).toContain("Music");
    const tokens = await api.post<AuthTokens>("auth/login", { email: "admin@pegwin.in", password: "demo1234" });
    const authed = createApiClient({
      baseUrl: MOCK_BASE_URL,
      tokens: {
        getAccessToken: () => tokens.accessToken,
        getRefreshToken: () => tokens.refreshToken,
        save: () => undefined,
        clear: () => undefined,
      },
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    const me = await authed.get<User>("users/me");
    expect(me.role).toBe("super_admin");
  });
});
