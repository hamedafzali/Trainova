// AI-powered progression analysis API endpoint
// Analyzes workout data to provide evidence-based progression recommendations

import { NextRequest, NextResponse } from "next/server";
import { analyzeProgression, analyzeWeeklyProgression, ProgressionError } from "@/services/ai/progression";
import { getToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    if (!action || !data) {
      return NextResponse.json({ error: "Missing action or data" }, { status: 400 });
    }

    let result;

    switch (action) {
      case "analyze_exercise":
        result = await analyzeProgression(data);
        break;

      case "analyze_weekly":
        result = await analyzeWeeklyProgression(data);
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Progression analysis error:", error);

    if (error instanceof ProgressionError) {
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
