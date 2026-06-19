import type { Pool } from "pg";
import { bearer, verifyToken } from "./auth";

/** Returns the requester's id if they're a trainer or admin (DB-checked). */
export async function requireTrainer(req: Request, pool: Pool): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  const u = await verifyToken(token);
  if (!u) return null;
  const r = await pool.query("select role from users where id = $1", [u.userId]);
  const role = r.rows[0]?.role;
  return role === "trainer" || role === "admin" ? u.userId : null;
}

/** True if the trainer has an active link to the client. */
export async function isLinked(
  pool: Pool,
  trainerId: string,
  clientId: string
): Promise<boolean> {
  const r = await pool.query(
    "select 1 from coach_clients where trainer_id = $1 and client_id = $2 and status = 'active'",
    [trainerId, clientId]
  );
  return r.rowCount! > 0;
}
