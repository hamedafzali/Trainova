import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { isLinked, requireTrainer } from "@/server/trainer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assign a plan snapshot to a linked client.
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainer = await requireTrainer(req, pool);
  if (!trainer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const clientId = body?.clientId as string;
  const name = body?.name as string;
  const payload = body?.payload;
  if (!clientId || !name || typeof payload !== "object") {
    return NextResponse.json({ error: "clientId, name and payload required" }, { status: 400 });
  }
  if (!(await isLinked(pool, trainer, clientId))) {
    return NextResponse.json({ error: "Not your client" }, { status: 403 });
  }

  await pool.query(
    "insert into assignments (trainer_id, client_id, name, payload) values ($1, $2, $3, $4)",
    [trainer, clientId, name, payload]
  );
  return NextResponse.json({ ok: true });
}
