import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type { Pool } from "pg";

/**
 * Real Postgres (PGlite, WASM) behind the subset of the `pg` Pool API the
 * server uses: `query(text, params)` and `connect()` → client with
 * `query`/`release`. Lets integration tests run SQL and migrations in CI
 * without Docker. Parameterless multi-statement text goes through `exec`,
 * like pg's simple-query protocol.
 */
export async function createTestPool(): Promise<{ pool: Pool; db: PGlite; close: () => Promise<void> }> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  // pg reports the row count for SELECT too; PGlite's affectedRows is 0 there.
  const count = (r: { rows: unknown[]; affectedRows?: number }) => Math.max(r.affectedRows ?? 0, r.rows.length);
  const query = async (text: string, params?: unknown[]) => {
    if (!params || params.length === 0) {
      const results = await db.exec(text);
      const last = results[results.length - 1] ?? { rows: [], affectedRows: 0 };
      return { rows: last.rows, rowCount: count(last) };
    }
    const r = await db.query(text, params);
    return { rows: r.rows, rowCount: count(r) };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
    end: async () => undefined,
  } as unknown as Pool;
  return { pool, db, close: () => db.close() };
}
