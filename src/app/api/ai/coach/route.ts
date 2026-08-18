// AI Coach mentor endpoint. Two actions:
//   - "intro":  a short, number-free motivational line above the (already
//               client-computed) insight cards.
//   - "meals":  meal ideas fit to already-computed macro targets.
// Both are additive enrichment over deterministic numbers computed on the
// client (src/domain/coach.ts) — this route never computes or returns a
// training/nutrition figure itself, only text.

import { NextRequest, NextResponse } from "next/server";
import { getCoachIntro, getMealIdeas, staticMealIdeas, CoachError } from "@/services/ai/coach";
import type { CoachIntroInput, MealIdeasInput } from "@/services/ai/prompts/coach";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";
import { cached } from "@/lib/cache/cacheMiddleware";
import { CACHE_KEYS, CACHE_TTL } from "@/lib/cache/cacheKeys";

function aiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_ENABLED === "1";
}

export async function POST(request: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: "AI features are disabled", code: "AI_DISABLED" }, { status: 404 });
  }

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
          () => getCoachIntro(data as CoachIntroInput),
          { ttl: CACHE_TTL.AI_COACH }
        );
        return NextResponse.json({ intro });
      }
      case "meals": {
        const input = data as MealIdeasInput;
        const result = await cached(
          CACHE_KEYS.AI_COACH_MEALS(authorization.user.userId, contextHash),
          () => getMealIdeas(input),
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
    if ((body as any)?.action === "meals") {
      return NextResponse.json(staticMealIdeas((body as any)?.data?.goal ?? null));
    }
    return NextResponse.json({ intro: null });
  }
}
