// AI-powered nutrition calculation API endpoint
// Calculates personalized nutrition targets based on user profile and goals

import { NextRequest, NextResponse } from "next/server";
import { calculateNutrition, NutritionError } from "@/services/ai/nutrition";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(authorization)) return authorization.response;

    const body = await request.json();

    if (!body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const result = await calculateNutrition(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Nutrition calculation error:", error);

    if (error instanceof NutritionError) {
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
