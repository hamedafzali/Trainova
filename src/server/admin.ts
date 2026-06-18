import { getPool } from "./db";
import { bearer, verifyToken } from "./auth";

/**
 * Returns the admin's user id if the request carries a valid token AND that user
 * is an admin (checked against the database, not just the token claim). Otherwise
 * null — callers answer 401/403.
 */
export async function requireAdmin(req: Request): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  const u = await verifyToken(token);
  if (!u) return null;
  const pool = getPool();
  if (!pool) return null;
  const r = await pool.query("select role from users where id = $1", [u.userId]);
  return r.rows[0]?.role === "admin" ? u.userId : null;
}

/** True when an email is the configured bootstrap admin. */
export function isBootstrapAdmin(email: string): boolean {
  const admin = process.env.ADMIN_EMAIL;
  return Boolean(admin && email.trim().toLowerCase() === admin.trim().toLowerCase());
}
