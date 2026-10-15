import { describe, expect, it } from "vitest";
import {
  normalizeIndianPhone,
  validateContact,
  validateCouponCode,
  validateEmail,
  validateName,
  validateOtp,
  validatePassword,
  validatePhone,
  validateQuantity,
  validateReason,
  validateTierCapacity,
  validateTierName,
} from "../src/lib/validation";

describe("auth validators mirror §1a/§2 constraints", () => {
  it("name is 1–100 chars", () => {
    expect(validateName("Asha")).toBeNull();
    expect(validateName("  ")).not.toBeNull();
    expect(validateName("x".repeat(101))).not.toBeNull();
  });

  it("password is 8–72 chars", () => {
    expect(validatePassword("s3cur3pwd")).toBeNull();
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("x".repeat(73))).not.toBeNull();
  });

  it("email is RFC-like, 3–254 chars", () => {
    expect(validateEmail("asha@example.com")).toBeNull();
    expect(validateEmail("not-an-email")).not.toBeNull();
    expect(validateEmail("a@")).not.toBeNull();
  });

  it("phone is a 10-digit Indian mobile number", () => {
    expect(validatePhone("9800000000")).toBeNull();
    expect(validatePhone("+919800000000")).toBeNull();
    expect(validatePhone("+91 98000 00000")).toBeNull();
    expect(validatePhone("09800000000")).toBeNull();
    expect(validatePhone("919800000000")).toBeNull();
    expect(validatePhone("+91")).not.toBeNull();
    expect(validatePhone("12345")).not.toBeNull();
    expect(validatePhone("5800000000")).not.toBeNull();
    expect(validatePhone("+1 5551234567")).not.toBeNull();
  });

  it("normalizes Indian input to E.164", () => {
    expect(normalizeIndianPhone("9800000000")).toBe("+919800000000");
    expect(normalizeIndianPhone("+91 98000 00000")).toBe("+919800000000");
    expect(normalizeIndianPhone("09800000000")).toBe("+919800000000");
    expect(normalizeIndianPhone("919800000000")).toBe("+919800000000");
    expect(normalizeIndianPhone("+1 5551234567")).toBeNull();
    expect(normalizeIndianPhone("12345")).toBeNull();
  });

  it("one of phone/email is required", () => {
    expect(validateContact("", "")).not.toBeNull();
    expect(validateContact("9800000000", "")).toBeNull();
    expect(validateContact("+919800000000", "")).toBeNull();
    expect(validateContact("", "asha@example.com")).toBeNull();
  });

  it("OTP is 6 digits", () => {
    expect(validateOtp("123456")).toBeNull();
    expect(validateOtp("12345")).not.toBeNull();
    expect(validateOtp("abcdef")).not.toBeNull();
  });
});

describe("booking validators mirror §6/§7 constraints", () => {
  it("quantity is 1–10", () => {
    expect(validateQuantity(1)).toBeNull();
    expect(validateQuantity(10)).toBeNull();
    expect(validateQuantity(0)).not.toBeNull();
    expect(validateQuantity(11)).not.toBeNull();
  });

  it("coupon codes are 1–50 chars", () => {
    expect(validateCouponCode("WELCOME10")).toBeNull();
    expect(validateCouponCode("")).not.toBeNull();
  });
});

describe("host validators mirror §5/§6 constraints", () => {
  it("tier names are 1–80 chars", () => {
    expect(validateTierName("Early bird")).toBeNull();
    expect(validateTierName("")).not.toBeNull();
  });

  it("tier capacity is 1–1,000,000", () => {
    expect(validateTierCapacity(100)).toBeNull();
    expect(validateTierCapacity(0)).not.toBeNull();
    expect(validateTierCapacity(1_000_001)).not.toBeNull();
  });

  it("reasons are required and bounded", () => {
    expect(validateReason("Venue issue")).toBeNull();
    expect(validateReason("  ")).not.toBeNull();
    expect(validateReason("x".repeat(501))).not.toBeNull();
  });
});
