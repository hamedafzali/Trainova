import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { getSessionUser, startSession, unauthorized } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current account + privacy settings. */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const pool = getPool()!;
  const r = await pool.query(
    "select ai_consent_at, ai_consent_version, analytics_opt_out, token_version from users where id = $1",
    [user.userId]
  );
  const row = r.rows[0] ?? {};
  const res = NextResponse.json({
    email: user.email,
    role: user.role,
    aiConsent: row.ai_consent_at ? { at: row.ai_consent_at, version: row.ai_consent_version } : null,
    analyticsOptOut: Boolean(row.analytics_opt_out),
  });
  // Clients from before cookie sessions authenticate with a bearer header:
  // move them onto the HttpOnly cookie so the token can leave localStorage.
  if (!req.headers.get("cookie")?.includes("tv_session=")) {
    await startSession(req, res, { ...user, id: user.userId, tokenVersion: row.token_version ?? 0 });
  }
  return res;
}
