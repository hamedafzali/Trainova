import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { endSession, getSessionUser } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign out this device; `{ everywhere: true }` also revokes every other session. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  if (body.everywhere === true) {
    const user = await getSessionUser(req);
    const pool = getPool();
    if (user && pool) {
      await pool.query("update users set token_version = token_version + 1 where id = $1", [user.userId]);
    }
  }
  return endSession(NextResponse.json({ ok: true }));
}
