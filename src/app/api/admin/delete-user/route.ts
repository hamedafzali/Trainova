import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Delete a user and their state (admin only; can't delete yourself).
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === admin) {
    return NextResponse.json({ error: "You can’t delete your own account here." }, { status: 400 });
  }

  // user_state has ON DELETE CASCADE, so this clears their data too.
  const r = await pool.query("delete from users where id = $1", [userId]);
  if (r.rowCount === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
