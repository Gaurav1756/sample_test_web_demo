/**
 * Request gating (Next.js 16 `proxy` convention; `middleware` is deprecated).
 *
 * UX-level routing only: signed-out visitors are sent to sign-in, and
 * obviously wrong-portal visits are sent home. Real authorization happens in
 * server components/layouts (see requireSession) and, authoritatively, in
 * the backend on every API call. Forging the role cookie only changes which
 * shell renders — all data calls still fail against the backend JWT.
 */
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, ROLE_COOKIE } from "./lib/cookies";

const HOST_ROLES = new Set(["host", "super_admin"]);
const ADMIN_ROLES = new Set(["super_admin"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  const signIn = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  };

  if (!hasSession) return signIn();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!ADMIN_ROLES.has(role ?? "")) {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return NextResponse.next();
  }
  if (pathname === "/host" || pathname.startsWith("/host/")) {
    // Event staff may only reach the scanner; everything else is host/admin.
    const allowed = pathname.startsWith("/host/scanner")
      ? [...HOST_ROLES, "event_staff"]
      : [...HOST_ROLES];
    if (!allowed.includes(role ?? "")) {
      return NextResponse.redirect(new URL("/home", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/host",
    "/host/:path*",
    "/admin",
    "/admin/:path*",
    "/bookings/:path*",
    "/tickets/:path*",
    "/saved",
    "/inbox",
    "/profile/:path*",
    "/settings/:path*",
    "/events/:id/checkout",
    "/events/:id/pay",
    "/onboarding/:path*",
    "/support",
    "/support/:path*",
    "/users/:path*",
  ],
};
