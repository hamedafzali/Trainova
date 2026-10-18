import { getPool } from "./db";
import { getSessionUser } from "./session";

/**
 * Returns the admin's user id if the request carries a valid token AND that user
 * is an admin (checked against the database, not just the token claim). Otherwise
 * null — callers answer 401/403.
 */
export async function requireAdmin(req: Request): Promise<string | null> {
  if (!getPool()) return null;
  const u = await getSessionUser(req);
  return u?.role === "admin" ? u.userId : null;
}

/** True when an email is the configured bootstrap admin. */
export function isBootstrapAdmin(email: string): boolean {
  const admin = process.env.ADMIN_EMAIL;
  return Boolean(admin && email.trim().toLowerCase() === admin.trim().toLowerCase());
}
