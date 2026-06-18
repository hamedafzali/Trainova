import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { getStats } from "@/server/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getStats(pool));
}
