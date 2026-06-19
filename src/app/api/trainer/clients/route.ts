import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireTrainer } from "@/server/trainer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List the trainer's clients with light progress stats.
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
  return NextResponse.json({ clients: r.rows });
}

// Link a client by email.
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainer = await requireTrainer(req, pool);
  if (!trainer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const u = await pool.query("select id from users where email = $1", [
    String(email).trim().toLowerCase(),
  ]);
  const clientId = u.rows[0]?.id;
  if (!clientId) return NextResponse.json({ error: "No account with that email" }, { status: 404 });
  if (clientId === trainer) {
    return NextResponse.json({ error: "You can’t add yourself" }, { status: 400 });
  }

  await pool.query(
    `insert into coach_clients (trainer_id, client_id, status) values ($1, $2, 'active')
     on conflict (trainer_id, client_id) do update set status = 'active'`,
    [trainer, clientId]
  );
  return NextResponse.json({ ok: true });
}
