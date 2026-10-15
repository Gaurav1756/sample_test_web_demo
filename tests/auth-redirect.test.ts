import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test for the swallowed-redirect bug: server actions must let
 * Next.js redirect() throws propagate so a successful sign-in navigates
 * instead of rendering "Something went wrong." while logged in.
 */
const jarData = vi.hoisted(() => new Map<string, string>());

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;push;${url}` });
  },
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (jarData.has(key) ? { value: jarData.get(key) as string } : undefined),
    set: (key: string, value: string) => {
      jarData.set(key, value);
    },
    delete: (key: string) => {
      jarData.delete(key);
    },
  }),
}));

// Import after the mocks above.
import { signIn, verifyOtp } from "../src/lib/auth-actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("auth actions navigate on success", () => {
  beforeEach(() => {
    jarData.clear();
    process.env.PEGWIN_DATA_SOURCE = "mock";
  });

  it("signIn with valid credentials redirects (not a failure result)", async () => {
    const outcome = await signIn({ ok: false }, form({ email: "attendee@pegwin.in", password: "demo1234" })).then(
      () => ({ redirected: false, url: "" }),
      (e: unknown) => ({ redirected: String((e as Error).message).startsWith("NEXT_REDIRECT:"), url: String((e as Error).message) }),
    );
    expect(outcome.redirected).toBe(true);
    expect(outcome.url).toContain("/home");
    // Session cookies were set before the redirect throw.
    expect(jarData.size).toBeGreaterThan(0);
  });

  it("signIn with wrong credentials returns a failure (no redirect)", async () => {
    const result = await signIn({ ok: false }, form({ email: "attendee@pegwin.in", password: "wrongpass" }));
    expect(result.ok).toBe(false);
  });

  it("verifyOtp with the demo code redirects", async () => {
    const outcome = await verifyOtp(
      { ok: false },
      form({ email: "host@pegwin.in", otp: "123456", purpose: "login" }),
    ).then(
      () => ({ redirected: false, url: "" }),
      (e: unknown) => ({ redirected: String((e as Error).message).startsWith("NEXT_REDIRECT:"), url: String((e as Error).message) }),
    );
    expect(outcome.redirected).toBe(true);
    expect(outcome.url).toContain("/host");
  });

  it("lands event staff directly on the scanner", async () => {
    const outcome = await signIn({ ok: false }, form({ email: "staff@pegwin.in", password: "demo1234" })).then(
      () => ({ redirected: false, url: "" }),
      (e: unknown) => ({ redirected: String((e as Error).message).startsWith("NEXT_REDIRECT:"), url: String((e as Error).message) }),
    );
    expect(outcome.redirected).toBe(true);
    expect(outcome.url).toContain("/host/scanner");
  });

  it("signIn accepts a 10-digit Indian mobile number", async () => {
    const outcome = await signIn({ ok: false }, form({ phone: "9820000001", password: "demo1234" })).then(
      (result) => ({ redirected: false, result }),
      (e: unknown) => ({ redirected: true, result: null as null, url: String((e as Error).message) }),
    );
    expect(outcome.redirected).toBe(true);
  });
});
