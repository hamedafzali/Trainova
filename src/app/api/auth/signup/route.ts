import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { hashPassword, jwtSecretConfigured, passwordProblem } from "@/server/auth";
import { isBootstrapAdmin } from "@/server/admin";
import { checkRateLimit, clientIp } from "@/server/rateLimit";
import { startSession } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool || !jwtSecretConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured on this server." }, { status: 503 });
  }

  if (await checkRateLimit(`ratelimit:signup:${clientIp(req)}`, { windowMs: WINDOW_MS, max: MAX_PER_IP })) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const role = isBootstrapAdmin(email) ? "admin" : "user";
    const hash = await hashPassword(body.password as string);
    const r = await pool.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3) returning id, token_version",
      [email, hash, role]
    );
    const res = NextResponse.json({ email, role });
    return startSession(req, res, { id: r.rows[0].id, email, role, tokenVersion: r.rows[0].token_version ?? 0 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "That email is already registered. Sign in instead." }, { status: 409 });
    }
    return NextResponse.json({ error: "Sign-up failed." }, { status: 500 });
  }
}
