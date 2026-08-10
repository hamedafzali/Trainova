// AI-powered program comparison and next phase recommendation API endpoint
// Analyzes program history and recommends next training phase

import { NextRequest, NextResponse } from "next/server";
import { analyzeProgramCompletion, ProgramComparisonError } from "@/services/ai/programComparison";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(authorization)) return authorization.response;

    const body = await request.json();

    if (!body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const result = await analyzeProgramCompletion(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Program comparison error:", error);

    if (error instanceof ProgramComparisonError) {
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
