import { NextRequest, NextResponse } from "next/server";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";
import { aiConfigured } from "@/server/aiConfig";
import { meteredAi } from "@/server/aiRuns";
import { getPool } from "@/server/db";
import { getSessionUser } from "@/server/session";
import { ANALYST_PERIODS, ANALYST_SCHEMA } from "@/domain/analyst";
import { analyse, analystInputFromState, type AnalystResult } from "@/services/ai/analyst";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

// One analysis per user, synced-data version, period and day. The data can't
// change without the version changing, so a hit is always current.
const MAX_CACHE = 500;
const cache = new Map<string, AnalystResult>();

function remember(key: string, value: AnalystResult) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
}

/** The client's local day, if it's within a day of the server's; otherwise the server's (UTC). */
function dayFrom(v: unknown): string {
  const server = new Date().toISOString().slice(0, 10);
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return server;
  return Math.abs(Date.parse(`${v}T00:00:00Z`) - Date.parse(`${server}T00:00:00Z`)) <= DAY_MS ? v : server;
}

/**
 * POST { weeks, today } → { evidence, interpretation, fallback, dataVersion }.
 * The evidence is built here from the synced document, never from the request.
 */
export async function POST(request: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Accounts are not configured.", code: "AI_DISABLED" }, { status: 503 });

  const ai = aiConfigured();
  let userId: string;
  if (ai) {
    const auth = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(auth)) return auth.response;
    userId = auth.user.userId;
  } else {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Sign in to use the analyst.", code: "UNAUTHORIZED" }, { status: 401 });
    userId = user.userId;
  }

  const body = (await request.json().catch(() => null)) as { weeks?: unknown; today?: unknown } | null;
  const weeks = ANALYST_PERIODS.find((p) => p === body?.weeks);
  if (!weeks) return NextResponse.json({ error: "Choose 4, 8 or 12 weeks.", code: "INVALID_INPUT" }, { status: 400 });
  const today = dayFrom(body?.today);

  const row = (await pool.query("select data, version from user_state where user_id = $1", [userId])).rows[0];
  const dataVersion = row ? Number(row.version) : 0;
  const key = `${userId}:${dataVersion}:${weeks}:${today}:${ANALYST_SCHEMA}:${ai ? "ai" : "rules"}`;

  let result = cache.get(key);
  const cached = Boolean(result);
  if (!result) {
    try {
      const input = analystInputFromState(row?.data);
      result = await meteredAi({ userId, task: "analyst", inputVersion: ANALYST_SCHEMA }, () =>
        analyse(input, weeks, today, { ai }),
      );
    } catch (e) {
      console.error("Analyst error:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Something went wrong. Try again.", code: "INTERNAL" }, { status: 500 });
    }
    // An outage is retried on the next request rather than remembered.
    if (result.fallback !== "unavailable") remember(key, result);
  }
  return NextResponse.json({ ...result, dataVersion, cached });
}
