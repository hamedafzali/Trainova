import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { hashPassword, signToken } from "@/server/auth";
import { isBootstrapAdmin } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const { email, password } = await req.json().catch(() => ({}) as Record<string, string>);
  if (!email || !password || String(password).length < 6) {
    return NextResponse.json({ error: "Enter an email and a 6+ character password." }, { status: 400 });
  }

  try {
    const normalized = String(email).trim().toLowerCase();
    const role = isBootstrapAdmin(normalized) ? "admin" : "user";
    const hash = await hashPassword(String(password));
    const r = await pool.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3) returning id",
      [normalized, hash, role]
    );
    const token = await signToken(r.rows[0].id, normalized, role);
    return NextResponse.json({ token, email: normalized, role });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "Sign-up failed." }, { status: 500 });
  }
}
