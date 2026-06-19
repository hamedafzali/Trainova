import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, role } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!userId || !["user", "trainer", "admin"].includes(role)) {
    return NextResponse.json({ error: "userId and a valid role required" }, { status: 400 });
  }
  const r = await pool.query("update users set role = $1 where id = $2", [role, userId]);
  if (r.rowCount === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
