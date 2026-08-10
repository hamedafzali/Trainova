import { NextResponse } from "next/server";
import { bearer, verifyToken } from "@/server/auth";
import { getPool } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_NAME = /^[a-z][a-z0-9_]{1,63}$/;

export async function POST(request: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true, stored: false });

  const token = bearer(request);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as
    | { name?: unknown; properties?: unknown }
    | null;
  const name = typeof body?.name === "string" ? body.name : "";
  if (!EVENT_NAME.test(name)) {
    return NextResponse.json({ error: "Invalid event name" }, { status: 400 });
  }
  const properties = body?.properties && typeof body.properties === "object" && !Array.isArray(body.properties)
    ? body.properties
    : {};

  await pool.query(
    "insert into product_events (user_id, event_name, properties) values ($1, $2, $3)",
    [user.userId, name, properties],
  );
  return NextResponse.json({ ok: true, stored: true });
}
