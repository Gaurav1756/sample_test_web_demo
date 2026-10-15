/**
 * Backend-for-frontend proxy: same-origin /api/* → Pegwin backend.
 *
 * Lets browser components call documented endpoints without ever holding
 * tokens: the access token is attached server-side from httpOnly cookies,
 * a single refresh-on-401 is attempted, and backend cookies are never
 * forwarded. Backend responses (including errors) pass through untouched.
 */
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function backendError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function proxy(req: NextRequest, segments: string[]) {
  const baseUrl = process.env.PEGWIN_API_BASE_URL;
  if (!baseUrl) return backendError(500, "MISCONFIGURED", "API base URL is not configured.");
  if (segments.some((s) => s === ".." || s.includes("\\"))) {
    return backendError(400, "VALIDATION_ERROR", "Invalid request path.");
  }

  const target = `${baseUrl.replace(/\/$/, "")}/${segments.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const forward = async (accessToken: string | undefined) => {
    const headers = new Headers();
    headers.set("accept", "application/json");
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

    const hasBody = req.method !== "GET" && req.method !== "DELETE";
    return fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? Buffer.from(await req.arrayBuffer()) : undefined,
      redirect: "manual",
    });
  };

  let upstream: Response;
  try {
    upstream = await forward(req.cookies.get(ACCESS_COOKIE)?.value);
  } catch {
    return backendError(502, "BACKEND_UNREACHABLE", "The Pegwin service is unreachable right now.");
  }

  // Single refresh-on-401, then retry once with the rotated pair.
  let rotated: { accessToken: string; refreshToken: string } | null = null;
  if (upstream.status === 401) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const pair = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
          rotated = pair;
          upstream = await forward(pair.accessToken);
        }
      } catch {
        // Fall through with the original 401 response.
      }
    }
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  const res = new NextResponse(body, { status: upstream.status });
  const upstreamContentType = upstream.headers.get("content-type");
  res.headers.set("content-type", upstreamContentType ?? "application/json");
  // Deliberately never forward backend Set-Cookie headers.
  if (rotated) {
    const secure = process.env.NODE_ENV === "production";
    res.cookies.set(ACCESS_COOKIE, rotated.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
    res.cookies.set(REFRESH_COOKIE, rotated.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
  }
  return res;
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { allow: METHODS.join(", ") },
  });
}
