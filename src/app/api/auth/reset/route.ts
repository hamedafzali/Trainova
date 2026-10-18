import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { hashPassword, hashResetToken, passwordProblem } from "@/server/auth";
import { checkRateLimit, clientIp } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  if (await checkRateLimit(`ratelimit:reset:ip:${clientIp(req)}`, { windowMs: 15 * 60 * 1000, max: 20 })) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const token = typeof body.token === "string" ? body.token : "";
  const problem = passwordProblem(body.password);
  if (!token) return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Consume the token atomically so it can only ever be used once.
  const r = await pool.query(
    "delete from password_reset_tokens where token_hash = $1 and expires_at > now() returning user_id",
    [hashResetToken(token)]
  );
  const userId = r.rows[0]?.user_id;
  if (!userId) {
    return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  }

  const hash = await hashPassword(body.password as string);
  // Bumping token_version signs out every existing session (e.g. an attacker's).
  await pool.query(
    "update users set password_hash = $1, token_version = token_version + 1 where id = $2",
    [hash, userId]
  );
  await pool.query("delete from password_reset_tokens where user_id = $1", [userId]);
  return NextResponse.json({ ok: true });
}
