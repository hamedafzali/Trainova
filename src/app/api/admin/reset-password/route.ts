import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { hashPassword } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Set a new password for any user (admin only).
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, password } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!userId || !password || String(password).length < 6) {
    return NextResponse.json({ error: "userId and a 6+ char password required" }, { status: 400 });
  }

  const hash = await hashPassword(String(password));
  const r = await pool.query("update users set password_hash = $1 where id = $2", [hash, userId]);
  if (r.rowCount === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
