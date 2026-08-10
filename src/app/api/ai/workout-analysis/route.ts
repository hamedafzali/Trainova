import { NextRequest, NextResponse } from "next/server";
import { analyzeWorkout } from "@/services/ai/workoutAnalysis";
import type { WorkoutAnalysisInput } from "@/services/ai/prompts/workoutAnalysis";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(authorization)) return authorization.response;
    const body = await request.json();
    const { action, data } = body;

    if (action === "analyze_workout") {
      const analysisData = data as WorkoutAnalysisInput;

      // Validate required fields
      if (!analysisData.userProfile || !analysisData.workoutData) {
        return NextResponse.json(
          { error: "Missing required data: userProfile and workoutData" },
          { status: 400 },
        );
      }

      // Perform workout analysis
      const analysis = await analyzeWorkout(analysisData);

      return NextResponse.json({ success: true, analysis });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Workout analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
        code: error instanceof Error && "code" in error ? (error as any).code : "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
