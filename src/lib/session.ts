/**
 * Server-only session helpers. Tokens live in httpOnly cookies and are
 * attached to backend requests on the server; the browser never sees them.
 * Roles come from the backend user object — never from user input.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { forbidden } from "next/navigation";
import { createApiClient } from "./api-client";
import { ACCESS_COOKIE, REFRESH_COOKIE, ROLE_COOKIE } from "./cookies";
import type { Role, User } from "./api-types";
import { MOCK_BASE_URL, dataSourceKind } from "./data-source";
import { mockFetch } from "./mock/mock-fetch";

export function apiBaseUrl(): string {
  // Mock mode needs no backend URL; the placeholder origin is never fetched.
  if (dataSourceKind() === "mock") return MOCK_BASE_URL;
  const url = process.env.PEGWIN_API_BASE_URL;
  if (!url) throw new Error("PEGWIN_API_BASE_URL is not configured.");
  return url;
}

function cookieFlags(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  role: Role;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  const role = jar.get(ROLE_COOKIE)?.value as Role | undefined;
  if (!accessToken || !refreshToken || !role) return null;
  return { accessToken, refreshToken, role };
}

export async function setSession(tokens: { accessToken: string; refreshToken: string }, role: Role): Promise<void> {
  const jar = await cookies();
  // Access tokens are short-lived; refresh lives longer (API §1).
  jar.set(ACCESS_COOKIE, tokens.accessToken, cookieFlags(15 * 60));
  jar.set(REFRESH_COOKIE, tokens.refreshToken, cookieFlags(7 * 24 * 3600));
  jar.set(ROLE_COOKIE, role, cookieFlags(7 * 24 * 3600));
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ROLE_COOKIE);
}

/** API client wired to the current request's session cookies. */
export async function serverApi() {
  const jar = await cookies();
  return createApiClient({
    baseUrl: apiBaseUrl(),
    // Sample-data mode serves every path from the in-memory mock backend;
    // pages and actions call the identical client surface either way.
    ...(dataSourceKind() === "mock" ? { fetchImpl: mockFetch as typeof fetch } : {}),
    tokens: {
      getAccessToken: () => jar.get(ACCESS_COOKIE)?.value,
      getRefreshToken: () => jar.get(REFRESH_COOKIE)?.value,
      save: async (t) => {
        jar.set(ACCESS_COOKIE, t.accessToken, cookieFlags(15 * 60));
        jar.set(REFRESH_COOKIE, t.refreshToken, cookieFlags(7 * 24 * 3600));
      },
      clear: async () => {
        jar.delete(ACCESS_COOKIE);
        jar.delete(REFRESH_COOKIE);
        jar.delete(ROLE_COOKIE);
      },
    },
  });
}

/** Current backend user, cached per request. Null when signed out. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    const api = await serverApi();
    return await api.get<User>("users/me");
  } catch {
    return null;
  }
});

/**
 * Require a signed-in user with one of the given roles in a server
 * component or layout. Redirects to sign-in when anonymous; renders
 * forbidden when the role is insufficient. This is a UX gate — the
 * backend re-checks authorization on every request.
 */
export async function requireSession(roles?: Role[]): Promise<{ user: User }> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (roles && !roles.includes(user.role)) forbidden();
  return { user };
}
