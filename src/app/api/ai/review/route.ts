import { NextRequest, NextResponse } from "next/server";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";
import { aiConfigured, aiDisabledResponse } from "@/server/aiConfig";
import { meteredAi } from "@/server/aiRuns";
import { parseTrainerContext, reviewTraining } from "@/services/ai/trainer";
import { LlmError } from "@/services/ai/llm";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 200_000;

/** POST { context } → TrainerReview */
export async function POST(request: NextRequest) {
  if (!aiConfigured()) return aiDisabledResponse();
  const authorization = await authorizeAiRequest(request);
  if (!isAuthorizedAiRequest(authorization)) return authorization.response;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large.", code: "INVALID_INPUT" }, { status: 413 });
  }
  let body: { context?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON.", code: "INVALID_INPUT" }, { status: 400 });
  }
  const context = parseTrainerContext(body.context);
  if (!context) return NextResponse.json({ error: "Missing training context.", code: "INVALID_INPUT" }, { status: 400 });

  try {
    const review = await meteredAi({ userId: authorization.user.userId, task: "trainer.review" }, () => reviewTraining(context));
    return NextResponse.json(review);
  } catch (e) {
    if (e instanceof LlmError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "AI_UNAVAILABLE" ? 503 : 502 });
    }
    console.error("Review error:", e);
    return NextResponse.json({ error: "Something went wrong. Try again.", code: "INTERNAL" }, { status: 500 });
  }
}
