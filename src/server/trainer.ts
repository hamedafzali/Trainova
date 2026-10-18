import type { Pool } from "pg";
import { getSessionUser } from "./session";

/** Returns the requester's id if they're a trainer or admin (DB-checked). */
export async function requireTrainer(req: Request, _pool: Pool): Promise<string | null> {
  const u = await getSessionUser(req);
  return u && (u.role === "trainer" || u.role === "admin") ? u.userId : null;
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
