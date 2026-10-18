// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestPool } from "@/test/pgPool";
import { MIGRATIONS, runMigrations } from "./migrations";

describe("runMigrations", () => {
  it("applies every migration on an empty database, then is a no-op", async () => {
    const { pool, close } = await createTestPool();
    try {
      expect(await runMigrations(pool)).toEqual(MIGRATIONS.map((m) => m.id));
      expect(await runMigrations(pool)).toEqual([]);
      const cols = await pool.query(
        "select column_name from information_schema.columns where table_name = 'users'"
      );
      const names = cols.rows.map((r) => r.column_name);
      expect(names).toEqual(expect.arrayContaining(["token_version", "ai_consent_at", "analytics_opt_out"]));
    } finally {
      await close();
    }
  });

  it("upgrades a legacy database: pre-consent trainer links become pending", async () => {
    const { pool, close } = await createTestPool();
    try {
      // A database created by an old release: baseline only, with an active link.
      await pool.query(MIGRATIONS[0].sql);
      const a = await pool.query("insert into users (email, password_hash) values ('t@x', 'h') returning id", []);
      const b = await pool.query("insert into users (email, password_hash) values ('c@x', 'h') returning id", []);
      await pool.query("insert into coach_clients (trainer_id, client_id, status) values ($1, $2, 'active')", [
        a.rows[0].id,
        b.rows[0].id,
      ]);

      await runMigrations(pool);

      const link = await pool.query("select status from coach_clients", []);
      expect(link.rows[0].status).toBe("pending");
      await expect(
        pool.query("insert into coach_clients (trainer_id, client_id, status) values ($1, $2, 'bogus')", [
          b.rows[0].id,
          a.rows[0].id,
        ])
      ).rejects.toThrow();
    } finally {
      await close();
    }
  });
});
