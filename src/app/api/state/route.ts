import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { getSessionUser } from "@/server/session";
import { MAX_SNAPSHOT_BYTES, validateSnapshot } from "@/domain/snapshotSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notConfigured = () => NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Pull the user's synced state.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return notConfigured();
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const r = await pool.query("select data, updated_at, version from user_state where user_id = $1", [
    user.userId,
  ]);
  const row = r.rows[0];
  return NextResponse.json({
    data: row?.data ?? null,
    updatedAt: row?.updated_at ?? null,
    version: row ? Number(row.version) : 0,
  });
}

/**
 * Push the user's state with optimistic concurrency. The client sends the
 * version it last pulled (`baseVersion`); the write only lands if nobody else
 * wrote since (atomic compare-and-set). Otherwise 409 returns the current copy
 * so the client can merge and retry. Older clients send the `base` timestamp,
 * which is mapped onto the current version when it matches.
 */
export async function PUT(req: Request) {
  const pool = getPool();
  if (!pool) return notConfigured();
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const raw = await req.text().catch(() => "");
  if (Buffer.byteLength(raw, "utf8") > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "Your data is too large to sync.", code: "TOO_LARGE" }, { status: 413 });
  }
  let body: { data?: unknown; baseVersion?: unknown; base?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (!body || typeof body.data !== "object" || body.data === null) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const issues = validateSnapshot(body.data);
  if (issues.length) {
    return NextResponse.json({ error: "Invalid data", code: "INVALID", issues }, { status: 422 });
  }

  const cur = await pool.query("select data, updated_at, version from user_state where user_id = $1", [
    user.userId,
  ]);
  const row = cur.rows[0];
  const conflict = (r: { data: unknown; updated_at: unknown; version: unknown }) =>
    NextResponse.json(
      { conflict: true, data: r.data, updatedAt: r.updated_at, version: Number(r.version) },
      { status: 409 }
    );

  if (!row) {
    const ins = await pool.query(
      `insert into user_state (user_id, data, updated_at, version) values ($1, $2, now(), 1)
       on conflict (user_id) do nothing returning updated_at, version`,
      [user.userId, body.data]
    );
    if (ins.rows[0]) {
      return NextResponse.json({ ok: true, updatedAt: ins.rows[0].updated_at, version: Number(ins.rows[0].version) });
    }
    // Another device created the row in the meantime.
    const now = await pool.query("select data, updated_at, version from user_state where user_id = $1", [user.userId]);
    return conflict(now.rows[0]);
  }

  // A row exists: the client must prove it has seen it.
  let expected: number | null = null;
  if (typeof body.baseVersion === "number" && Number.isInteger(body.baseVersion)) {
    expected = body.baseVersion;
  } else if (typeof body.base === "string" && !Number.isNaN(Date.parse(body.base))) {
    if (new Date(row.updated_at).getTime() === Date.parse(body.base)) expected = Number(row.version);
  }
  if (expected === null || expected !== Number(row.version)) return conflict(row);

  const upd = await pool.query(
    `update user_state set data = $2, updated_at = now(), version = version + 1
     where user_id = $1 and version = $3 returning updated_at, version`,
    [user.userId, body.data, expected]
  );
  if (!upd.rows[0]) {
    const now = await pool.query("select data, updated_at, version from user_state where user_id = $1", [user.userId]);
    return conflict(now.rows[0]);
  }
  return NextResponse.json({ ok: true, updatedAt: upd.rows[0].updated_at, version: Number(upd.rows[0].version) });
}
