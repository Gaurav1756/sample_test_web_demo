/**
 * Sample auth endpoints (§2): register, OTP, login, password recovery,
 * refresh and logout. Deterministic demo accounts (see fixtures-events):
 * attendee/host/staff/admin @pegwin.in with password demo1234; any OTP
 * flow accepts code 123456. Tokens are opaque mock strings.
 */
import type { AuthTokens, User } from "../api-types";
import { normalizeIndianPhone } from "../validation";
import {
  asRecord,
  created,
  err,
  fail,
  ok,
  type MockHandler,
} from "./router";
import { daysAgo, nowIso, uid, type MockStore } from "./store";

export const MOCK_OTP = "123456";

function contactKey(body: Record<string, unknown>): string | null {
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const raw = phone || email || null;
  if (!raw || raw.includes("@")) return raw;
  return normalizeIndianPhone(raw) ?? raw;
}

function mintTokens(store: MockStore, userId: string): { accessToken: string; refreshToken: string } {
  const rand = () => Math.random().toString(36).slice(2, 8);
  const accessToken = `mock-at-${userId}-${rand()}`;
  const refreshToken = `mock-rt-${userId}-${rand()}`;
  store.accessTokens[accessToken] = userId;
  store.refreshTokens[refreshToken] = userId;
  return { accessToken, refreshToken };
}

function tokenResponse(store: MockStore, user: User): AuthTokens {
  return { ...mintTokens(store, user.id), user };
}

function otpOk(store: MockStore, contact: string, otp: unknown): boolean {
  if (otp === MOCK_OTP) return true;
  return store.pendingOtps[contact] === otp;
}

export const handleAuth: MockHandler = (store, req) => {
  const [head, action, leaf] = req.segments;
  if (head !== "auth") return null;
  const body = asRecord(req.body);

  if (req.method === "POST" && action === "register") {
    const contact = contactKey(body);
    if (!contact) return err(400, "VALIDATION_ERROR", "An email or phone number is required.");
    if (store.contactIndex[contact]) {
      return err(409, "ACCOUNT_EXISTS", "An account with these details already exists.");
    }
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "New Member";
    const id = uid(store, "u");
    const user: User = {
      id,
      name,
      username: name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || id,
      phone: typeof body.phone === "string" ? body.phone : null,
      email: typeof body.email === "string" ? body.email.toLowerCase() : null,
      role: "user",
      city: null,
      country: "India",
      locale: "en",
      visibility: { profileVisible: true },
      createdAt: nowIso(),
    };
    store.users.push(user);
    store.passwords[id] = typeof body.password === "string" ? body.password : "";
    store.contactIndex[contact] = id;
    store.pendingOtps[contact] = MOCK_OTP;
    store.notifPrefs[id] = {
      push: true, email: true, upcomingReminders: true, eventUpdates: true, ticketUpdates: true,
      savedActivity: true, communityActivity: true, communityEvents: true, mentionsReplies: true,
      recommendedEvents: false, nearbyEvents: false,
    };
    return created({ userId: id, otpRequired: true });
  }

  if (req.method === "POST" && action === "otp" && (leaf === "request" || leaf === "resend")) {
    const contact = contactKey(body);
    if (!contact) return err(400, "VALIDATION_ERROR", "An email or phone number is required.");
    store.pendingOtps[contact] = MOCK_OTP;
    return ok({ expiresInSec: 300 });
  }

  if (req.method === "POST" && action === "otp" && leaf === "verify") {
    const contact = contactKey(body);
    if (!contact) return err(400, "VALIDATION_ERROR", "An email or phone number is required.");
    if (!otpOk(store, contact, body.otp)) {
      return err(400, "INVALID_OR_EXPIRED_OTP", "This code is invalid or has expired.");
    }
    delete store.pendingOtps[contact];
    let userId = store.contactIndex[contact];
    if (!userId) {
      if (body.purpose !== "register") {
        return err(404, "ACCOUNT_NOT_FOUND", "No account found for these details.");
      }
      userId = uid(store, "u");
      const user: User = {
        id: userId, name: "New Member", username: userId, phone: null,
        email: contact.includes("@") ? contact : null, role: "user", city: null,
        country: "India", locale: "en", visibility: { profileVisible: true }, createdAt: daysAgo(0),
      };
      if (!contact.includes("@")) user.phone = contact;
      store.users.push(user);
      store.passwords[userId] = "";
      store.contactIndex[contact] = userId;
    }
    const user = store.users.find((u) => u.id === userId);
    if (!user) return err(404, "ACCOUNT_NOT_FOUND", "No account found for these details.");
    return ok(tokenResponse(store, user));
  }

  if (req.method === "POST" && action === "login") {
    const contact = contactKey(body);
    const password = typeof body.password === "string" ? body.password : "";
    const userId = contact ? store.contactIndex[contact] : undefined;
    const user = userId ? store.users.find((u) => u.id === userId) : undefined;
    if (!user || store.passwords[user.id] !== password) {
      return err(401, "INVALID_CREDENTIALS", "Incorrect details or password.");
    }
    return ok(tokenResponse(store, user));
  }

  if (req.method === "POST" && action === "password" && leaf === "forgot") {
    const contact = contactKey(body);
    if (contact) store.pendingOtps[contact] = MOCK_OTP;
    return ok({});
  }

  if (req.method === "POST" && action === "password" && leaf === "reset") {
    const contact = contactKey(body);
    if (!contact || !otpOk(store, contact, body.otp)) {
      return err(400, "INVALID_OR_EXPIRED_OTP", "This code is invalid or has expired.");
    }
    const userId = store.contactIndex[contact];
    if (!userId) return err(404, "ACCOUNT_NOT_FOUND", "No account found for these details.");
    if (typeof body.newPassword === "string" && body.newPassword) {
      store.passwords[userId] = body.newPassword;
    }
    delete store.pendingOtps[contact];
    return ok({});
  }

  if (req.method === "POST" && action === "refresh") {
    const token = typeof body.refreshToken === "string" ? body.refreshToken : "";
    const userId = store.refreshTokens[token];
    const user = userId ? store.users.find((u) => u.id === userId) : undefined;
    if (!user) {
      if (token) delete store.refreshTokens[token];
      fail(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
    }
    delete store.refreshTokens[token];
    return ok(tokenResponse(store, user));
  }

  if (req.method === "POST" && action === "logout") {
    void req;
    return ok({});
  }

  return null;
};
