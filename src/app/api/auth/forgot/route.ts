import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { appUrl, isMailEnabled, sendMail } from "@/server/mail";
import { checkRateLimit, clientIp } from "@/server/rateLimit";
import { hashResetToken } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!isMailEnabled()) {
    return NextResponse.json(
      { error: "Password reset isn’t set up here. Ask an admin to reset it." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Enter your email." }, { status: 400 });

  // Stop mail-bombing a mailbox and spraying the endpoint. The response is the
  // same either way, so the limit doesn't reveal whether an account exists.
  const [perEmail, perIp] = await Promise.all([
    checkRateLimit(`ratelimit:forgot:acct:${email}`, { windowMs: 60 * 60 * 1000, max: 3 }),
    checkRateLimit(`ratelimit:forgot:ip:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 20 }),
  ]);
  if (perEmail || perIp) return NextResponse.json({ ok: true });

  const u = await pool.query("select id from users where email = $1", [email]);
  const userId = u.rows[0]?.id;
  if (userId) {
    const token = randomBytes(32).toString("base64url");
    // One live link per account: a new request replaces older ones.
    await pool.query("delete from password_reset_tokens where user_id = $1", [userId]);
    await pool.query(
      "insert into password_reset_tokens (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')",
      [hashResetToken(token), userId]
    );
    const link = `${appUrl(req)}/reset?token=${token}`;
    try {
      await sendMail(
        email,
        "Reset your Trainova password",
        `<p>Tap to set a new password (valid 1 hour):</p><p><a href="${link}">${link}</a></p>` +
          `<p>If you didn’t request this, ignore this email — your password stays the same.</p>`
      );
    } catch {
      /* don't reveal delivery state */
    }
  }
  return NextResponse.json({ ok: true });
}
