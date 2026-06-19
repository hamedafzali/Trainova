import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { hashPassword } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { token, password } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!token || !password || String(password).length < 6) {
    return NextResponse.json({ error: "A 6+ character password is required." }, { status: 400 });
  }

  const r = await pool.query(
    "select user_id from password_resets where token = $1 and expires_at > now()",
    [token]
  );
  const userId = r.rows[0]?.user_id;
  if (!userId) {
    return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  }

  const hash = await hashPassword(String(password));
  await pool.query("update users set password_hash = $1 where id = $2", [hash, userId]);
  await pool.query("delete from password_resets where user_id = $1", [userId]);
  return NextResponse.json({ ok: true });
}
