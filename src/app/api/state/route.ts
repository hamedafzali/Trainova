import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { bearer, verifyToken } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(req: Request) {
  const token = bearer(req);
  if (!token) return null;
  return verifyToken(token);
}

// Pull the user's synced state.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  const user = await authed(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await pool.query("select data, updated_at from user_state where user_id = $1", [
    user.userId,
  ]);
  return NextResponse.json({
    data: r.rows[0]?.data ?? null,
    updatedAt: r.rows[0]?.updated_at ?? null,
  });
}

// Push (upsert) the user's state.
export async function PUT(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  const user = await authed(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== "object") {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  await pool.query(
    `insert into user_state (user_id, data, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
    [user.userId, body.data]
  );
  return NextResponse.json({ ok: true });
}
