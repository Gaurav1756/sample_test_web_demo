"use server";

/**
 * Signed-in account actions: onboarding, profile, preferences, visibility,
 * locale and deletion. All mutations go through the backend (§3, §12);
 * backend responses are authoritative.
 */
import { redirect } from "next/navigation";
import { clearSession, requireSession, serverApi } from "./session";
import { actionFailed, type ActionResult } from "./action-result";
import type { NotificationPreferences, User } from "./api-types";
import { validateName } from "./validation";

const PREF_KEYS = [
  "push",
  "email",
  "upcomingReminders",
  "eventUpdates",
  "ticketUpdates",
  "savedActivity",
  "communityActivity",
  "communityEvents",
  "mentionsReplies",
  "recommendedEvents",
  "nearbyEvents",
] as const;

function prefsFrom(form: FormData): Partial<NotificationPreferences> {
  const prefs: Partial<NotificationPreferences> = {};
  for (const key of PREF_KEYS) {
    if (form.has(key)) prefs[key] = form.get(key) === "on";
  }
  return prefs;
}

export async function saveOnboarding(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  const interests = form.getAll("interests").map(String).slice(0, 10);
  const city = String(form.get("city") ?? "").trim();
  try {
    const api = await serverApi();
    await api.patch<User>("users/me", {
      ...(interests.length > 0 ? { interests } : {}),
      ...(city ? { city } : {}),
    });
    const prefs = prefsFrom(form);
    if (Object.keys(prefs).length > 0) {
      await api.patch<NotificationPreferences>("users/me/notification-preferences", prefs);
    }
    redirect("/home");
  } catch (e) {
    return actionFailed(e);
  }
}

export async function updateProfile(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const avatarUrl = String(form.get("avatarUrl") ?? "").trim();
  if (name) {
    const nameError = validateName(name);
    if (nameError) return { ok: false, message: nameError };
  }
  if (username && (username.length < 3 || username.length > 30)) {
    return { ok: false, message: "Username must be 3–30 characters." };
  }
  try {
    const api = await serverApi();
    await api.patch<User>("users/me", {
      ...(name ? { name } : {}),
      ...(username ? { username } : {}),
      ...(form.has("bio") ? { bio } : {}),
      ...(form.has("city") ? { city } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    });
    redirect("/profile?saved=1");
  } catch (e) {
    return actionFailed(e);
  }
}

export async function updateNotificationPrefs(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireSession();
  try {
    const api = await serverApi();
    const prefs: Record<string, boolean> = {};
    for (const key of PREF_KEYS) prefs[key] = form.get(key) === "on";
    await api.patch<NotificationPreferences>("users/me/notification-preferences", prefs);
    return { ok: true, message: "Preferences saved." };
  } catch (e) {
    return actionFailed(e);
  }
}

export async function updateVisibility(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  try {
    const api = await serverApi();
    // Only profileVisible is documented (CQ-02); nothing else is sent.
    await api.patch("users/me/visibility", { profileVisible: form.get("profileVisible") === "on" });
    return { ok: true, message: "Privacy setting saved." };
  } catch (e) {
    return actionFailed(e);
  }
}

export async function updateLocale(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  const locale = String(form.get("locale") ?? "").trim();
  if (!locale) return { ok: false, message: "Choose a language." };
  try {
    const api = await serverApi();
    await api.patch<User>("users/me", { locale });
    return { ok: true, message: "Language saved." };
  } catch (e) {
    return actionFailed(e);
  }
}

export async function deleteAccount(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  if (form.get("confirm") !== "DELETE") {
    return { ok: false, message: 'Type DELETE to confirm account deletion.' };
  }
  try {
    const api = await serverApi();
    await api.delete("users/me", { query: { confirm: "true" } });
  } catch (e) {
    return actionFailed(e);
  }
  await clearSession();
  redirect("/");
}
