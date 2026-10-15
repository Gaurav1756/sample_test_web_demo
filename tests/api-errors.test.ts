import { describe, expect, it } from "vitest";
import { ApiError, guidanceFor } from "../src/lib/api-errors";

describe("guidanceFor", () => {
  it("maps documented §14 codes to message + recovery", () => {
    for (const code of [
      "VALIDATION_ERROR",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "ACCOUNT_DELETED_OR_SUSPENDED",
      "JOIN_REQUIRES_APPROVAL",
      "MEDIA_NOT_ALLOWED_FOR_MEMBERS",
      "EVENT_NOT_FOUND",
      "NOT_FOUND",
      "ALREADY_CHECKED_IN",
      "EVENT_NOT_EDITABLE",
      "EVENT_NOT_LIVE",
      "INSUFFICIENT_INVENTORY",
      "PAYMENT_ALREADY_EXISTS",
      "TIER_CAPACITY_CONFLICT",
      "TIER_HAS_SALES",
      "COUPON_INVALID",
      "TICKET_INVALID_OR_EXPIRED",
      "OTP_COOLDOWN",
      "RATE_LIMITED",
      "INVALID_OR_EXPIRED_OTP",
      "HOLD_EXPIRED",
      "REFUND_FAILED",
      "GATEWAY_ERROR",
      "BACKEND_UNREACHABLE",
    ]) {
      const g = guidanceFor(code);
      expect(g.message.length, code).toBeGreaterThan(0);
      expect(g.recovery.length, code).toBeGreaterThan(0);
    }
  });

  it("gives hold expiry the re-select recovery path", () => {
    expect(guidanceFor("HOLD_EXPIRED").recovery).toMatch(/10-minute hold/);
  });

  it("falls back for unknown or missing codes", () => {
    expect(guidanceFor("SOMETHING_NEW").message).toBe("Something went wrong.");
    expect(guidanceFor(undefined).recovery).toMatch(/support/);
  });
});

describe("ApiError", () => {
  it("carries status, code, message and details", () => {
    const err = new ApiError(409, "ALREADY_CHECKED_IN", "Already in.", { ticketCode: "ABC" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(409);
    expect(err.code).toBe("ALREADY_CHECKED_IN");
    expect(err.details).toEqual({ ticketCode: "ABC" });
  });

  it("resolves its own guidance", () => {
    const err = new ApiError(422, "COUPON_INVALID", "Bad coupon.");
    expect(err.guidance().message).toBe("This coupon cannot be applied.");
  });
});
