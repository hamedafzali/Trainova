import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { verifyPassword, jwtSecretConfigured } from "@/server/auth";
import { isBootstrapAdmin } from "@/server/admin";
import { checkRateLimit, clientIp, resetRateLimit } from "@/server/rateLimit";
import { startSession } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Brute-force guards: per account (can't be dodged by rotating addresses) and
// per client address (stops one source spraying many accounts).
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 30;

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool || !jwtSecretConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const accountKey = `ratelimit:login:acct:${email}`;
  const ipKey = `ratelimit:login:ip:${clientIp(req)}`;
  const [acctLimited, ipLimited] = await Promise.all([
    checkRateLimit(accountKey, { windowMs: WINDOW_MS, max: MAX_PER_ACCOUNT }),
    checkRateLimit(ipKey, { windowMs: WINDOW_MS, max: MAX_PER_IP }),
  ]);
  if (acctLimited || ipLimited) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const r = await pool.query("select id, password_hash, role, token_version from users where email = $1", [email]);
  const row = r.rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  let role = row.role as string;
  if (isBootstrapAdmin(email) && role !== "admin") {
    await pool.query("update users set role = 'admin' where id = $1", [row.id]);
    role = "admin";
  }

  await resetRateLimit(accountKey);
  const res = NextResponse.json({ email, role });
  return startSession(req, res, { id: row.id, email, role, tokenVersion: row.token_version ?? 0 });
}
