import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { verifyPassword } from "@/server/auth";
import { endSession, getSessionUser, unauthorized } from "@/server/session";
import { checkRateLimit } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Permanently delete the signed-in account. Requires the current password.
// Everything owned by the user cascades; rows that only keep the user id for
// aggregate metrics (events, AI run logs) are removed explicitly.
export async function DELETE(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (await checkRateLimit(`ratelimit:delete:${user.userId}`, { windowMs: 900_000, max: 5 })) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
  }
  const r = await pool.query("select password_hash from users where id = $1", [user.userId]);
  if (!r.rows[0] || !(await verifyPassword(password, r.rows[0].password_hash))) {
    return NextResponse.json({ error: "Password is incorrect." }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from product_events where user_id = $1", [user.userId]);
    await client.query("delete from ai_runs where user_id = $1", [user.userId]);
    await client.query("delete from users where id = $1", [user.userId]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return endSession(NextResponse.json({ ok: true }));
}
