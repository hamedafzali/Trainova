import type { Pool } from "pg";
import { sql as baseline } from "./migrations/001_baseline";
import { sql as security } from "./migrations/002_security";
import { sql as stateVersion } from "./migrations/003_state_version";

/**
 * Ordered, append-only schema migrations. `db/init` only runs when Postgres
 * creates an empty volume, so long-lived databases never saw later files;
 * this runner brings every database to the same schema at server start.
 *
 * Rules: never edit a shipped migration, only append. Each one runs in a
 * transaction and is recorded in `schema_migrations`.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  { id: "001_baseline", sql: baseline },
  { id: "002_security", sql: security },
  { id: "003_state_version", sql: stateVersion },
];

// Arbitrary constant so concurrent app instances don't migrate simultaneously.
const LOCK_KEY = 4_810_112;

export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(
      `create table if not exists schema_migrations (
         id text primary key,
         applied_at timestamptz not null default now()
       )`
    );
    const done = new Set(
      (await client.query("select id from schema_migrations")).rows.map((r) => r.id as string)
    );
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      try {
        await client.query("begin");
        await client.query(m.sql);
        await client.query("insert into schema_migrations (id) values ($1)", [m.id]);
        await client.query("commit");
        applied.push(m.id);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`Migration ${m.id} failed: ${(e as Error).message}`);
      }
    }
    return applied;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

let ready: Promise<void> | null = null;

/** Run pending migrations once per process; later callers await the same run. */
export function ensureMigrated(pool: Pool): Promise<void> {
  ready ??= runMigrations(pool).then(
    (ids) => {
      if (ids.length) console.log(`[db] applied migrations: ${ids.join(", ")}`);
    },
    (e) => {
      ready = null; // retry on the next request instead of wedging forever
      throw e;
    }
  );
  return ready;
}
