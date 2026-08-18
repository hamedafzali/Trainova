import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { signToken, verifyPassword } from "@/server/auth";
import { isBootstrapAdmin } from "@/server/admin";
import { checkRateLimit, resetRateLimit } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Redis-backed brute-force guard (shared across instances, survives
// restarts). 10 tries / 5 min per ip+email. Fails open if Redis is down.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_TRIES = 10;

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const { email, password } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local";
  const key = `ratelimit:login:${ip}:${String(email).trim().toLowerCase()}`;
  if (await checkRateLimit(key, { windowMs: WINDOW_MS, max: MAX_TRIES })) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const normalized = String(email).trim().toLowerCase();
  const r = await pool.query("select id, password_hash, role from users where email = $1", [
    normalized,
  ]);
  const row = r.rows[0];
  if (!row || !(await verifyPassword(String(password), row.password_hash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  // Promote the configured bootstrap admin on login.
  let role = row.role as string;
  if (isBootstrapAdmin(normalized) && role !== "admin") {
    await pool.query("update users set role = 'admin' where id = $1", [row.id]);
    role = "admin";
  }

  await resetRateLimit(key); // success clears the counter
  const token = await signToken(row.id, normalized, role);
  return NextResponse.json({ token, email: normalized, role });
}
