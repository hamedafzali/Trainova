import { NextRequest, NextResponse } from "next/server";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";
import { aiConfigured } from "@/server/aiConfig";
import { getPool } from "@/server/db";
import { getSessionUser } from "@/server/session";
import { EXERCISE_COACH_SCHEMA } from "@/domain/exerciseCoach";
import {
  cleanQuestion,
  coachExercise,
  exerciseCoachInputFromState,
  type ExerciseCoachResult,
} from "@/services/ai/exerciseCoach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One reading per user, synced-data version, exercise and question. The data
// can't change without the version changing, so a hit is always current.
const MAX_CACHE = 500;
const cache = new Map<string, ExerciseCoachResult>();

function remember(key: string, value: ExerciseCoachResult) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
}

const id = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 100 ? v : null);

/**
 * POST { sessionId, exerciseId, question? } → { evidence, reading, fallback, dataVersion }.
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
    if (!user) return NextResponse.json({ error: "Sign in to use the coach.", code: "UNAUTHORIZED" }, { status: 401 });
    userId = user.userId;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = id(body?.sessionId);
  const exerciseId = id(body?.exerciseId);
  if (!sessionId || !exerciseId) {
    return NextResponse.json({ error: "Pick an exercise in a workout.", code: "INVALID_INPUT" }, { status: 400 });
  }
  const question = cleanQuestion(body?.question);

  const row = (await pool.query("select data, version from user_state where user_id = $1", [userId])).rows[0];
  const dataVersion = row ? Number(row.version) : 0;
  const key = JSON.stringify([userId, dataVersion, sessionId, exerciseId, question, EXERCISE_COACH_SCHEMA, ai]);

  let result = cache.get(key) ?? null;
  const cached = Boolean(result);
  if (!result) {
    try {
      result = await coachExercise(exerciseCoachInputFromState(row?.data), sessionId, exerciseId, question, { ai });
    } catch (e) {
      console.error("Exercise coach error:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Something went wrong. Try again.", code: "INTERNAL" }, { status: 500 });
    }
    if (!result) {
      return NextResponse.json(
        { error: "That exercise isn't in your synced workout yet. Try again in a moment.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    // An outage is retried on the next request rather than remembered.
    if (result.fallback !== "unavailable") remember(key, result);
  }
  return NextResponse.json({ ...result, dataVersion, cached });
}
