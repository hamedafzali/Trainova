import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { appUrl, isMailEnabled, sendMail } from "@/server/mail";

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

  const { email } = await req.json().catch(() => ({}) as Record<string, string>);
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return NextResponse.json({ error: "Enter your email." }, { status: 400 });

  const u = await pool.query("select id from users where email = $1", [normalized]);
  const userId = u.rows[0]?.id;
  // Always respond ok so we don't reveal whether the email is registered.
  if (userId) {
    const token = randomBytes(32).toString("hex");
    await pool.query(
      "insert into password_resets (token, user_id, expires_at) values ($1, $2, now() + interval '1 hour')",
      [token, userId]
    );
    const link = `${appUrl(req)}/reset?token=${token}`;
    try {
      await sendMail(
        normalized,
        "Reset your Trainova password",
        `<p>Tap to set a new password (valid 1 hour):</p><p><a href="${link}">${link}</a></p>` +
          `<p>If you didn’t request this, ignore this email.</p>`
      );
    } catch {
      /* swallow — don't reveal delivery state */
    }
  }
  return NextResponse.json({ ok: true });
}
