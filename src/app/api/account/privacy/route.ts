import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { getSessionUser, unauthorized } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bump when the AI data-sharing disclosure text changes materially. */
const AI_CONSENT_VERSION = "2026-10";

// Update privacy choices: AI data sharing (consent recorded with a version and
// timestamp) and product analytics opt-out.
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { aiConsent?: unknown; analyticsOptOut?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Bad payload" }, { status: 400 });

  if (typeof body.aiConsent === "boolean") {
    await pool.query(
      body.aiConsent
        ? "update users set ai_consent_at = now(), ai_consent_version = $2 where id = $1"
        : "update users set ai_consent_at = null, ai_consent_version = null where id = $1",
      body.aiConsent ? [user.userId, AI_CONSENT_VERSION] : [user.userId]
    );
  }
  if (typeof body.analyticsOptOut === "boolean") {
    await pool.query("update users set analytics_opt_out = $2 where id = $1", [user.userId, body.analyticsOptOut]);
    // Opting out also removes what was already collected.
    if (body.analyticsOptOut) await pool.query("delete from product_events where user_id = $1", [user.userId]);
  }
  return NextResponse.json({ ok: true });
}
