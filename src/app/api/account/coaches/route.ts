import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { getSessionUser, unauthorized } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The client's side of coaching links: invitations to answer and active coaches.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ links: [] });
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const r = await pool.query(
    `select c.trainer_id as "trainerId", u.email as "trainerEmail", c.status, c.created_at as "invitedAt"
     from coach_clients c join users u on u.id = c.trainer_id
     where c.client_id = $1 and c.status in ('pending', 'active')
     order by c.created_at desc`,
    [user.userId]
  );
  return NextResponse.json({ links: r.rows });
}

const TRANSITIONS = {
  accept: { from: ["pending"], to: "active" },
  decline: { from: ["pending"], to: "declined" },
  revoke: { from: ["active"], to: "revoked" },
} as const;

// Accept/decline an invitation, or stop sharing data with an active coach.
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { trainerId?: unknown; action?: unknown } | null;
  const action = body?.action;
  if (typeof body?.trainerId !== "string" || typeof action !== "string" || !(action in TRANSITIONS)) {
    return NextResponse.json({ error: "trainerId and a valid action are required" }, { status: 400 });
  }
  const t = TRANSITIONS[action as keyof typeof TRANSITIONS];
  const r = await pool.query(
    `update coach_clients set status = $3, responded_at = now()
     where client_id = $1 and trainer_id = $2 and status = any($4::text[])`,
    [user.userId, body.trainerId, t.to, t.from]
  );
  if (!r.rowCount) return NextResponse.json({ error: "Nothing to update" }, { status: 404 });
  return NextResponse.json({ ok: true, status: t.to });
}
