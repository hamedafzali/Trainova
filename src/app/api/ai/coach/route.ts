// AI Coach mentor endpoint. Two actions:
//   - "intro":  a short, number-free motivational line above the (already
//               client-computed) insight cards.
//   - "meals":  meal ideas fit to macro targets the server recomputes from
//               the body stats sent, through the same floors and gates as
//               the app (src/domain/nutrition.ts). Opted-out or gated users
//               (minors, pregnancy, medical) never reach the model.
// The route returns text only, never a training or nutrition figure.

import { NextRequest, NextResponse } from "next/server";
import { getCoachIntro, getMealIdeas, mealIdeasInputFor, staticMealIdeas, CoachError } from "@/services/ai/coach";
import type { CoachIntroInput } from "@/services/ai/prompts/coach";
import type { NutritionSettings } from "@/domain/nutrition";
import { getPool } from "@/server/db";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";
import { aiConfigured, aiDisabledResponse } from "@/server/aiConfig";
import { meteredAi } from "@/server/aiRuns";
import { cached } from "@/lib/cache/cacheMiddleware";
import { CACHE_KEYS, CACHE_TTL } from "@/lib/cache/cacheKeys";

/** The nutrition settings in the user's synced profile, if any. */
async function syncedNutrition(userId: string): Promise<NutritionSettings | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const row = (await pool.query("select data->'profile'->'nutrition' as n from user_state where user_id = $1", [userId])).rows[0];
    return row?.n && typeof row.n === "object" ? (row.n as NutritionSettings) : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!aiConfigured()) return aiDisabledResponse();

  const body = await request.json().catch(() => null);

  try {
    const authorization = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(authorization)) return authorization.response;

    const { action, data, contextHash } = (body ?? {}) as {
      action: string;
      data: unknown;
      contextHash: string;
    };
    if (!contextHash) {
      return NextResponse.json({ error: "Missing contextHash", code: "INVALID_INPUT" }, { status: 400 });
    }

    switch (action) {
      case "intro": {
        const intro = await cached(
          CACHE_KEYS.AI_COACH_INTRO(authorization.user.userId, contextHash),
          () => meteredAi({ userId: authorization.user.userId, task: "coach.intro" }, () => getCoachIntro(data as CoachIntroInput)),
          { ttl: CACHE_TTL.AI_COACH }
        );
        return NextResponse.json({ intro });
      }
      case "meals": {
        const built = mealIdeasInputFor(data, await syncedNutrition(authorization.user.userId));
        if (!built.ok) return NextResponse.json({ mealIdeas: null, nutrition: built.status });
        const input = built.input;
        const result = await cached(
          CACHE_KEYS.AI_COACH_MEALS(authorization.user.userId, contextHash),
          () => meteredAi({ userId: authorization.user.userId, task: "coach.meals" }, () => getMealIdeas(input)),
          { ttl: CACHE_TTL.AI_COACH }
        );
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: "Invalid action", validActions: ["intro", "meals"] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Coach API error:", error);
    if (error instanceof CoachError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "AI_UNAVAILABLE" ? 503 : 400 }
      );
    }
    // Meal ideas has a safe static fallback — never fail the request outright.
    if ((body as any)?.action === "meals" && mealIdeasInputFor((body as any)?.data, null).ok) {
      return NextResponse.json(staticMealIdeas((body as any)?.data?.goal ?? null));
    }
    return NextResponse.json({ intro: null });
  }
}
