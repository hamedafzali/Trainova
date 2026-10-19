import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { getAiRunStats } from "@/server/aiRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERIODS = [1, 7, 30];

/** GET ?days=1|7|30 → AiRunStats. Aggregates only: no prompts, replies or user ids. */
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  try {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const days = Number(new URL(req.url).searchParams.get("days"));
    return NextResponse.json(await getAiRunStats(pool, PERIODS.includes(days) ? days : 7));
  } catch (e) {
    console.error("Failed to load AI run stats:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load AI stats." }, { status: 500 });
  }
}
