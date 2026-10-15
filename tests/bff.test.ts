import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api-errors";
import { bff } from "../src/lib/bff";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bff", () => {
  it("calls same-origin /api paths with JSON body", async () => {
    const seen: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        seen.push(new Request(url as string, init));
        return jsonResponse(200, { ok: true });
      }),
    );
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    const res = await bff<{ ok: boolean }>("checkout/quote", {
      method: "POST",
      body: { items: [] },
      query: { limit: 5 },
    });
    expect(res).toEqual({ ok: true });
    expect(seen[0].url).toBe("https://app.test/api/checkout/quote?limit=5");
    expect(seen[0].method).toBe("POST");
  });

  it("forwards Idempotency-Key", async () => {
    let key: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        key = new Request(url as string, init).headers.get("idempotency-key");
        return jsonResponse(201, { orderId: "o1" });
      }),
    );
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    await bff("orders", { method: "POST", body: {}, idempotencyKey: "k1" });
    expect(key).toBe("k1");
  });

  it("throws ApiError on backend error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, { error: { code: "COUPON_INVALID", message: "Bad code." } }),
      ),
    );
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    const err = (await bff("x", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("COUPON_INVALID");
  });

  it("maps network failure to BACKEND_UNREACHABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    const err = (await bff("events").catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe("BACKEND_UNREACHABLE");
    expect(err.status).toBe(502);
  });
});
