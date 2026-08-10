// AI-powered form cues API endpoint
// Provides exercise-specific form guidance based on exercise name and user experience

import { NextRequest, NextResponse } from "next/server";
import { getFormCues, FormCuesError } from "@/services/ai/formCues";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(authorization)) return authorization.response;

    const body = await request.json();

    if (!body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const result = await getFormCues(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Form cues error:", error);

    if (error instanceof FormCuesError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "AI_UNAVAILABLE" ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
