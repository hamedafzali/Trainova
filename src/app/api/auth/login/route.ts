import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { signToken, verifyPassword } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory brute-force guard (per server process). 10 tries / 5 min per ip+email.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_TRIES = 10;
const tries = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const e = tries.get(key);
  if (!e || now > e.resetAt) {
    tries.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > MAX_TRIES;
}

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const { email, password } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local";
  const key = `${ip}:${String(email).trim().toLowerCase()}`;
  if (rateLimited(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const r = await pool.query("select id, password_hash from users where email = $1", [
    String(email).trim().toLowerCase(),
  ]);
  const row = r.rows[0];
  if (!row || !(await verifyPassword(String(password), row.password_hash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  tries.delete(key); // success clears the counter
  const token = await signToken(row.id, String(email));
  return NextResponse.json({ token, email: String(email).trim().toLowerCase() });
}
