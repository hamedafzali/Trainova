import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { bearer, verifyToken } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pending plan assignments for the signed-in user.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ assignments: [] });
  const token = bearer(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await pool.query(
    `select a.id, a.name, a.payload, a.created_at, u.email as trainer_email
     from assignments a join users u on u.id = a.trainer_id
     where a.client_id = $1 and a.imported = false
     order by a.created_at desc`,
    [user.userId]
  );
  return NextResponse.json({ assignments: r.rows });
}

// Mark an assignment imported (after the client imports it locally).
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const token = bearer(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await pool.query("update assignments set imported = true where id = $1 and client_id = $2", [
    id,
    user.userId,
  ]);
  return NextResponse.json({ ok: true });
}
