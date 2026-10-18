import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireTrainer } from "@/server/trainer";
import { checkRateLimit } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The same answer whether or not an account exists, so the invite form can't
// be used to discover who uses Trainova.
const INVITE_SENT = {
  ok: true,
  message: "If that email has a Trainova account, they'll see your invitation and can accept it.",
};

// Active clients with light progress stats, plus invitations still pending.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainer = await requireTrainer(req, pool);
  if (!trainer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const r = await pool.query(
    `select u.id, u.email,
            coalesce((
              select count(*) from jsonb_array_elements(coalesce(us.data->'sessions','[]'::jsonb)) s
              where s->>'status' = 'completed'
            ), 0) as workouts
     from coach_clients c
     join users u on u.id = c.client_id
     left join user_state us on us.user_id = c.client_id
     where c.trainer_id = $1 and c.status = 'active'
     order by u.email`,
    [trainer]
  );
  const pending = await pool.query(
    `select u.id, u.email, c.created_at as "invitedAt"
     from coach_clients c join users u on u.id = c.client_id
     where c.trainer_id = $1 and c.status = 'pending'
     order by c.created_at desc`,
    [trainer]
  );
  return NextResponse.json({ clients: r.rows, pending: pending.rows });
}

// Invite a client by email. The link stays pending until the client accepts.
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainer = await requireTrainer(req, pool);
  if (!trainer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (await checkRateLimit(`ratelimit:invite:${trainer}`, { windowMs: 3_600_000, max: 30 })) {
    return NextResponse.json({ error: "Too many invitations. Try again later." }, { status: 429 });
  }

  const { email } = await req.json().catch(() => ({}) as Record<string, string>);
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const u = await pool.query("select id from users where email = $1", [normalized]);
  const clientId = u.rows[0]?.id;
  if (clientId === trainer) {
    return NextResponse.json({ error: "You can’t add yourself" }, { status: 400 });
  }
  if (clientId) {
    // Re-inviting after a decline/revoke is allowed; an active link is kept.
    await pool.query(
      `insert into coach_clients (trainer_id, client_id, status) values ($1, $2, 'pending')
       on conflict (trainer_id, client_id) do update
         set status = 'pending', created_at = now(), responded_at = null
         where coach_clients.status <> 'active'`,
      [trainer, clientId]
    );
  }
  return NextResponse.json(INVITE_SENT);
}

// End a coaching link (or withdraw a pending invitation).
export async function DELETE(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainer = await requireTrainer(req, pool);
  if (!trainer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { clientId } = await req.json().catch(() => ({}) as Record<string, string>);
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  await pool.query(
    `update coach_clients set status = 'revoked', responded_at = now()
     where trainer_id = $1 and client_id = $2 and status in ('pending', 'active')`,
    [trainer, clientId]
  );
  return NextResponse.json({ ok: true });
}
