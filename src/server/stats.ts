import type { Pool } from "pg";

export interface AdminStats {
  users: number;
  admins: number;
  trainers: number;
  withData: number;
  new7d: number;
  new30d: number;
  workouts: number;
  setsLogged: number;
  active7d: number;
  devices: number;
}

const n = (v: unknown) => Number(v ?? 0);

/** Aggregate platform stats. Workout/set counts read from each user's JSONB state. */
export async function getStats(pool: Pool): Promise<AdminStats> {
  const users = await pool.query(`
    select
      (select count(*) from users) as users,
      (select count(*) from users where role = 'admin') as admins,
      (select count(*) from users where role = 'trainer') as trainers,
      (select count(*) from user_state) as with_data,
      (select count(*) from users where created_at > now() - interval '7 days') as new_7d,
      (select count(*) from users where created_at > now() - interval '30 days') as new_30d,
      (select count(*) from devices) as devices
  `);

  const safe = async (sql: string): Promise<number> => {
    try {
      const r = await pool.query(sql);
      return n(r.rows[0]?.n);
    } catch {
      return 0;
    }
  };

  const workouts = await safe(`
    select count(*)::int as n
    from user_state us, jsonb_array_elements(coalesce(us.data->'sessions','[]'::jsonb)) s
    where s->>'status' = 'completed'`);

  const setsLogged = await safe(`
    select count(*)::int as n
    from user_state us, jsonb_array_elements(coalesce(us.data->'sets','[]'::jsonb)) x
    where (x->>'completed') = 'true'`);

  const active7d = await safe(`
    select count(distinct us.user_id)::int as n
    from user_state us, jsonb_array_elements(coalesce(us.data->'sessions','[]'::jsonb)) s
    where s->>'status' = 'completed'
      and (s->>'date') >= to_char((now() - interval '7 days')::date, 'YYYY-MM-DD')`);

  const row = users.rows[0];
  return {
    users: n(row.users),
    admins: n(row.admins),
    trainers: n(row.trainers),
    withData: n(row.with_data),
    new7d: n(row.new_7d),
    new30d: n(row.new_30d),
    devices: n(row.devices),
    workouts,
    setsLogged,
    active7d,
  };
}
