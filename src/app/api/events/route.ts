import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { getPool } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_NAME = /^[a-z][a-z0-9_]{1,63}$/;

export async function POST(request: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true, stored: false });

  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Respect the account's analytics opt-out server-side too.
  const opt = await pool.query("select analytics_opt_out from users where id = $1", [user.userId]);
  if (opt.rows[0]?.analytics_opt_out) return NextResponse.json({ ok: true, stored: false });

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
