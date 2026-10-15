/**
 * Backend error catalog (§14) mapped to user-facing messages with recovery
 * guidance, as required by BRD §14. Codes are exact strings from the spec;
 * messages are presentation-layer copy, never invented backend behavior.
 */

export interface ErrorGuidance {
  /** Short user-facing message. */
  message: string;
  /** What the user can do next. */
  recovery: string;
}

const CATALOG: Record<string, ErrorGuidance> = {
  VALIDATION_ERROR: {
    message: "Some details need attention.",
    recovery: "Review the highlighted fields and try again.",
  },
  UNAUTHENTICATED: {
    message: "Your session has expired.",
    recovery: "Please sign in again to continue.",
  },
  FORBIDDEN: {
    message: "You do not have permission for this action.",
    recovery: "If you believe this is a mistake, contact support.",
  },
  ACCOUNT_DELETED_OR_SUSPENDED: {
    message: "This account is no longer active.",
    recovery: "Contact support if you need help with your account.",
  },
  JOIN_REQUIRES_APPROVAL: {
    message: "This group requires approval to join.",
    recovery: "Your request has been noted; the hosts will review it.",
  },
  MEDIA_NOT_ALLOWED_FOR_MEMBERS: {
    message: "Only hosts can share media here.",
    recovery: "Send a text message instead.",
  },
  EVENT_NOT_FOUND: {
    message: "This event is unavailable.",
    recovery: "It may have been removed or is no longer public.",
  },
  NOT_FOUND: {
    message: "We could not find what you asked for.",
    recovery: "Check the link or go back and try again.",
  },
  ALREADY_CHECKED_IN: {
    message: "This ticket is already checked in.",
    recovery: "Each ticket admits one entry only.",
  },
  EVENT_NOT_EDITABLE: {
    message: "This event can no longer be edited.",
    recovery: "Only drafts and reschedulable events can be changed.",
  },
  EVENT_NOT_LIVE: {
    message: "Check-in is not open for this event.",
    recovery: "Check-in opens when the event goes live.",
  },
  INSUFFICIENT_INVENTORY: {
    message: "Not enough tickets are available.",
    recovery: "Reduce the quantity or choose another tier.",
  },
  PAYMENT_ALREADY_EXISTS: {
    message: "A payment already exists for this order.",
    recovery: "Check your bookings for the current status.",
  },
  TIER_CAPACITY_CONFLICT: {
    message: "Capacity cannot be set below tickets already sold.",
    recovery: "Increase the capacity and save again.",
  },
  TIER_HAS_SALES: {
    message: "This tier cannot be removed because it has sales.",
    recovery: "Disable sales for the tier instead of deleting it.",
  },
  COUPON_INVALID: {
    message: "This coupon cannot be applied.",
    recovery: "Check the code, eligible tiers and validity dates.",
  },
  TICKET_INVALID_OR_EXPIRED: {
    message: "This ticket is invalid or has expired.",
    recovery: "Confirm the ticket code and event dates.",
  },
  OTP_COOLDOWN: {
    message: "Please wait before requesting another code.",
    recovery: "Try again once the countdown finishes.",
  },
  RATE_LIMITED: {
    message: "Too many attempts. Please slow down.",
    recovery: "Wait a moment and try again.",
  },
  INVALID_OR_EXPIRED_OTP: {
    message: "This code is invalid or has expired.",
    recovery: "Request a new code and try again.",
  },
  HOLD_EXPIRED: {
    message: "Your ticket hold has expired.",
    recovery: "Select tickets again to start a fresh 10-minute hold.",
  },
  REFUND_FAILED: {
    message: "The refund could not be completed right now.",
    recovery: "It will be retried; check back shortly or contact support.",
  },
  GATEWAY_ERROR: {
    message: "The payment service is unavailable.",
    recovery: "Wait a moment and retry; you will not be charged twice.",
  },
  /** Client-side code used by our BFF when the backend is unreachable. */
  BACKEND_UNREACHABLE: {
    message: "The Pegwin service is unreachable right now.",
    recovery: "Check your connection and try again in a moment.",
  },
};

/** Resolve a backend error code to display copy. Unknown codes fall back. */
export function guidanceFor(code: string | undefined): ErrorGuidance {
  if (code && CATALOG[code]) return CATALOG[code];
  return {
    message: "Something went wrong.",
    recovery: "Please try again. If it persists, contact support.",
  };
}

/** Typed error thrown by the API client for non-2xx backend responses. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** User-facing copy for this error. */
  guidance(): ErrorGuidance {
    return guidanceFor(this.code);
  }
}
