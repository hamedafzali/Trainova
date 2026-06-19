import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { isLinked, requireTrainer } from "@/server/trainer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only view of a linked client's completed sessions (most recent first).
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainer = await requireTrainer(req, pool);
  if (!trainer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = new URL(req.url).searchParams.get("clientId") ?? "";
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (!(await isLinked(pool, trainer, clientId))) {
    return NextResponse.json({ error: "Not your client" }, { status: 403 });
  }

  const r = await pool.query("select data from user_state where user_id = $1", [clientId]);
  const data = r.rows[0]?.data ?? {};
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const completed = sessions
    .filter((s: Record<string, unknown>) => s.status === "completed")
    .sort((a: Record<string, string>, b: Record<string, string>) =>
      String(b.startedAt).localeCompare(String(a.startedAt))
    )
    .slice(0, 20)
    .map((s: Record<string, unknown>) => ({ title: s.title, date: s.date }));

  return NextResponse.json({ workouts: completed.length, sessions: completed });
}
