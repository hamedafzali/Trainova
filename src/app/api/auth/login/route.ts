import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { signToken, verifyPassword } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const { email, password } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const r = await pool.query("select id, password_hash from users where email = $1", [
    String(email).trim().toLowerCase(),
  ]);
  const row = r.rows[0];
  if (!row || !(await verifyPassword(String(password), row.password_hash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const token = await signToken(row.id, String(email));
  return NextResponse.json({ token, email: String(email).trim().toLowerCase() });
}
