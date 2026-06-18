import { Pool } from "pg";

// Lazily-created singleton pool. Returns null when no database is configured,
// so API routes can answer 503 instead of crashing (keeps guest mode working).
let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}
