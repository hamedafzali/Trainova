import { NextResponse } from "next/server";
import { bearer, verifyToken } from "@/server/auth";
import { getPool } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userFor(request: Request) {
  const token = bearer(request);
  return token ? verifyToken(token) : null;
}

export async function GET(request: Request) {
  const pool = getPool();
  const user = await userFor(request);
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await pool.query(
    "select date, sleep, stress, soreness, note, created_at from daily_checkins where user_id = $1 order by date desc limit 30",
    [user.userId],
  );
  return NextResponse.json({ checkins: result.rows });
}

export async function POST(request: Request) {
  const pool = getPool();
  const user = await userFor(request);
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validScore = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
  if (!body || !validScore(body.sleep) || !validScore(body.stress) || !validScore(body.soreness)) {
    return NextResponse.json({ error: "Sleep, stress, and soreness must be whole numbers from 1 to 5." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 500) || null : null;
  const result = await pool.query(
    `insert into daily_checkins (user_id, sleep, stress, soreness, note)
     values ($1, $2, $3, $4, $5)
     on conflict (user_id, date) do update set sleep = excluded.sleep, stress = excluded.stress, soreness = excluded.soreness, note = excluded.note, created_at = now()
     returning date, sleep, stress, soreness, note, created_at`,
    [user.userId, body.sleep, body.stress, body.soreness, note],
  );
  return NextResponse.json({ checkin: result.rows[0] });
}
