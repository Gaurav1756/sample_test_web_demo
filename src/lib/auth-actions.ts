"use server";

/**
 * Authentication server actions implementing the §2 contract.
 * Tokens are stored in httpOnly cookies (see session.ts); nothing
 * sensitive is ever returned to the browser.
 */
import { redirect } from "next/navigation";
import { createApiClient } from "./api-client";
import { apiBaseUrl, clearSession, serverApi, setSession } from "./session";
import { dataSourceKind } from "./data-source";
import { mockFetch } from "./mock/mock-fetch";
import type {
  AuthTokens,
  LoginResponse,
  OtpPurpose,
  OtpResponse,
  RegisterResponse,
  Role,
} from "./api-types";
import { loginRequiresOtp } from "./api-types";
import {
  normalizeIndianPhone,
  validateContact,
  validateName,
  validateOtp,
  validatePassword,
} from "./validation";

import { actionFailed as fail, type ActionResult } from "./action-result";

function publicApi() {
  return createApiClient({
    baseUrl: apiBaseUrl(),
    ...(dataSourceKind() === "mock" ? { fetchImpl: mockFetch as typeof fetch } : {}),
  });
}

/** Guard against open redirects: only same-origin absolute paths. */
function safeNext(value: string | undefined, fallback: string): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

function landingFor(role: Role): string {
  if (role === "super_admin") return "/admin";
  if (role === "host") return "/host";
  // Staff have no dashboard; their whole surface is the assigned scanner.
  if (role === "event_staff") return "/host/scanner";
  return "/home";
}

async function contactQuery(form: FormData): Promise<{ phone?: string; email?: string } | ActionResult> {
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const invalid = validateContact(phone, email);
  if (invalid) return { ok: false, message: invalid };
  // Send the normalized E.164 form so "98200 00001" and "+919820000001" match.
  const normalized = phone ? normalizeIndianPhone(phone) : null;
  return { ...(normalized ? { phone: normalized } : {}), ...(normalized ? {} : { email }) };
}

export async function signUp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (form.get("terms") !== "on") {
    return { ok: false, message: "Please accept the policies to create an account." };
  }
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;

  const nameError = validateName(name);
  if (nameError) return { ok: false, message: nameError };
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, message: passwordError };
  if (password !== confirm) return { ok: false, message: "Passwords do not match." };

  // redirect() throws: compute the destination inside try, navigate after,
  // so success is never swallowed into a failure result.
  let destination: string;
  try {
    const api = publicApi();
    const res = await api.post<RegisterResponse>("auth/register", {
      name,
      ...contact,
      password,
    });
    if (!res.otpRequired) return { ok: false, message: "Unexpected response. Please try again." };
    const next = safeNext(String(form.get("next") ?? ""), "");
    const q = new URLSearchParams({ purpose: "register", ...contact });
    if (next) q.set("next", next);
    destination = `/verify-otp?${q.toString()}`;
  } catch (e) {
    return fail(e);
  }
  redirect(destination);
}

async function requestOtpCode(
  contact: { phone?: string; email?: string },
  purpose: OtpPurpose,
): Promise<OtpResponse> {
  const api = publicApi();
  return api.post<OtpResponse>("auth/otp/request", { ...contact, purpose });
}

export async function startLoginOtp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;
  let destination: string;
  try {
    await requestOtpCode(contact, "login");
    const next = safeNext(String(form.get("next") ?? ""), "");
    const q = new URLSearchParams({ purpose: "login", ...contact });
    if (next) q.set("next", next);
    destination = `/verify-otp?${q.toString()}`;
  } catch (e) {
    return fail(e);
  }
  redirect(destination);
}

export async function verifyOtp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;
  const otp = String(form.get("otp") ?? "").trim();
  const otpError = validateOtp(otp);
  if (otpError) return { ok: false, message: otpError };
  const purpose = String(form.get("purpose") ?? "") as OtpPurpose;
  if (!["register", "login", "reset"].includes(purpose)) {
    return { ok: false, message: "Invalid verification request. Start again." };
  }
  let destination: string;
  try {
    const api = publicApi();
    const res = await api.post<AuthTokens>("auth/otp/verify", { ...contact, otp, purpose });
    await setSession(
      { accessToken: res.accessToken, refreshToken: res.refreshToken },
      res.user.role,
    );
    const next = safeNext(String(form.get("next") ?? ""), "");
    // New registrations continue to onboarding (AUTH-05); everyone else home.
    destination = !next && purpose === "register" ? "/onboarding/preferences" : next || landingFor(res.user.role);
  } catch (e) {
    return fail(e);
  }
  redirect(destination);
}

export async function resendOtp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;
  const purpose = String(form.get("purpose") ?? "") as OtpPurpose;
  if (!["register", "login", "reset"].includes(purpose)) {
    return { ok: false, message: "Invalid verification request. Start again." };
  }
  try {
    // CQ-23 assumption: resend takes the same body as request (with purpose).
    const api = publicApi();
    await api.post<OtpResponse>("auth/otp/resend", { ...contact, purpose });
    return { ok: true, message: "A new code is on its way." };
  } catch (e) {
    return fail(e);
  }
}

export async function signIn(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;
  const password = String(form.get("password") ?? "");
  if (!password) return { ok: false, message: "Enter your password, or continue with a code." };
  let destination: string;
  try {
    const api = publicApi();
    const res = await api.post<LoginResponse>("auth/login", { ...contact, password });
    const next = safeNext(String(form.get("next") ?? ""), "");
    if (loginRequiresOtp(res)) {
      const q = new URLSearchParams({ purpose: "login", ...contact });
      if (next) q.set("next", next);
      destination = `/verify-otp?${q.toString()}`;
    } else {
      await setSession(
        { accessToken: res.accessToken, refreshToken: res.refreshToken },
        res.user.role,
      );
      destination = next || landingFor(res.user.role);
    }
  } catch (e) {
    return fail(e);
  }
  redirect(destination);
}

export async function forgotPassword(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;
  let destination: string;
  try {
    const api = publicApi();
    await api.post("auth/password/forgot", contact);
    const q = new URLSearchParams({ ...contact });
    destination = `/reset-password?${q.toString()}`;
  } catch (e) {
    return fail(e);
  }
  redirect(destination);
}

export async function resetPassword(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const contact = await contactQuery(form);
  if ("ok" in contact) return contact;
  const otp = String(form.get("otp") ?? "").trim();
  const otpError = validateOtp(otp);
  if (otpError) return { ok: false, message: otpError };
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, message: passwordError };
  if (password !== confirm) return { ok: false, message: "Passwords do not match." };
  let destination: string;
  try {
    const api = publicApi();
    await api.post("auth/password/reset", { ...contact, otp, newPassword: password });
    destination = "/sign-in?reset=1";
  } catch (e) {
    return fail(e);
  }
  redirect(destination);
}

export async function signOut(): Promise<void> {
  try {
    const api = await serverApi();
    await api.post("auth/logout");
  } catch {
    // Best-effort: still clear local cookies below.
  }
  await clearSession();
  redirect("/");
}
