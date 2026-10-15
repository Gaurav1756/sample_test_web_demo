/**
 * Client-side fast-fail validation mirroring documented backend constraints
 * (§1a and per-API field tables). The backend remains authoritative; these
 * checks only surface obvious mistakes before a request is sent.
 */

export function validateName(value: string): string | null {
  const v = value.trim();
  if (v.length < 1) return "Name is required.";
  if (v.length > 100) return "Name must be 100 characters or fewer.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 72) return "Password must be 72 characters or fewer.";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v.length < 3 || v.length > 254) return "Enter an email between 3 and 254 characters.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

/**
 * Normalize Indian mobile input to E.164 (+91XXXXXXXXXX), or null when
 * invalid. Accepts a 10-digit number starting 6–9 with an optional
 * +91 / 91 / 0 prefix; spaces and dashes are ignored. The app is
 * India-only, so no other country codes are accepted.
 */
export function normalizeIndianPhone(value: string): string | null {
  const digits = value.replace(/[^\d]/g, "");
  let rest = digits;
  if (rest.length === 12 && rest.startsWith("91")) rest = rest.slice(2);
  else if (rest.length === 11 && rest.startsWith("0")) rest = rest.slice(1);
  if (!/^[6-9][0-9]{9}$/.test(rest)) return null;
  return `+91${rest}`;
}

export function validatePhone(value: string): string | null {
  if (!normalizeIndianPhone(value)) return "Enter a valid 10-digit Indian mobile number.";
  return null;
}

/** One of phone/email is required for auth contact fields (M* in spec). */
export function validateContact(phone: string, email: string): string | null {
  if (!phone.trim() && !email.trim()) return "Enter a phone number or an email address.";
  if (phone.trim()) return validatePhone(phone);
  return validateEmail(email);
}

export function validateOtp(value: string): string | null {
  if (!/^[0-9]{6}$/.test(value.trim())) return "Enter the 6-digit code.";
  return null;
}

export function validateQuantity(qty: number): string | null {
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return "Quantity must be between 1 and 10.";
  return null;
}

export function validateCouponCode(value: string): string | null {
  const v = value.trim();
  if (v.length < 1 || v.length > 50) return "Enter a coupon code up to 50 characters.";
  return null;
}

export function validateTierName(value: string): string | null {
  const v = value.trim();
  if (v.length < 1) return "Tier name is required.";
  if (v.length > 80) return "Tier name must be 80 characters or fewer.";
  return null;
}

export function validateTierCapacity(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000)
    return "Capacity must be between 1 and 1,000,000.";
  return null;
}

export function validateReason(value: string, max = 500): string | null {
  const v = value.trim();
  if (v.length < 1) return "A reason is required.";
  if (v.length > max) return `Reason must be ${max} characters or fewer.`;
  return null;
}
