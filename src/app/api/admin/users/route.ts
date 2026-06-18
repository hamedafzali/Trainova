import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List all users (admin only).
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const r = await pool.query(
    `select u.id, u.email, u.role, u.created_at,
            (select count(*) from user_state s where s.user_id = u.id) as has_state
     from users u order by u.created_at asc`
  );
  return NextResponse.json({ users: r.rows });
}
