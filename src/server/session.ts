import { NextResponse } from "next/server";
import { getPool } from "./db";
import { signToken, verifyToken } from "./auth";

export const SESSION_COOKIE = "tv_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type SessionUser = {
  userId: string;
  email: string;
  /** Always read from the database, never trusted from the token claim. */
  role: "user" | "trainer" | "admin";
};

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie-authenticated writes must come from our own origin (CSRF). Browsers
 * always send Origin on cross-site POST/PUT/DELETE; SameSite=Lax already
 * blocks the cookie there, this is defence in depth.
 */
export function sameOrigin(req: Request): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Resolves the signed-in user from the HttpOnly session cookie (or, during the
 * transition from localStorage tokens, an Authorization bearer). The token's
 * version must match `users.token_version`, so a password reset or "sign out
 * everywhere" revokes every outstanding session. Returns null when signed out.
 */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const cookie = readCookie(req, SESSION_COOKIE);
  const header = req.headers.get("authorization") ?? "";
  const token = cookie ?? (header.startsWith("Bearer ") ? header.slice(7) : null);
  if (!token) return null;
  if (cookie && !sameOrigin(req)) return null;

  const claims = await verifyToken(token);
  if (!claims) return null;
  const pool = getPool();
  if (!pool) return null;
  const r = await pool.query("select email, role, token_version from users where id = $1", [claims.userId]);
  const row = r.rows[0];
  if (!row) return null;
  if ((row.token_version ?? 0) !== claims.version) return null;
  return { userId: claims.userId, email: row.email, role: row.role };
}

function isHttps(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}

/** Issue a session for the user and attach it as an HttpOnly cookie. */
export async function startSession(
  req: Request,
  res: NextResponse,
  user: { id: string; email: string; role: string; tokenVersion: number }
): Promise<NextResponse> {
  const token = await signToken(user.id, user.email, user.role, user.tokenVersion);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Plain-HTTP LAN installs still work; behind TLS the cookie is Secure.
    secure: isHttps(req),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

export function endSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export function unauthorized(message = "Sign in again.") {
  return NextResponse.json({ error: message, code: "UNAUTHORIZED" }, { status: 401 });
}
