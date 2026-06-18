import { NextResponse } from "next/server";
import { bearer, verifyToken } from "@/server/auth";
import { generatePlan, isAiEnabled } from "@/server/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json({ error: "AI is not configured on this server." }, { status: 503 });
  }
  const token = bearer(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });

  const { goal, experience, equipment } = await req
    .json()
    .catch(() => ({}) as Record<string, string>);

  try {
    const plan = await generatePlan({
      goal: String(goal || "general fitness"),
      experience: String(experience || "beginner"),
      equipment: equipment ? String(equipment) : undefined,
    });
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "Couldn’t generate a plan. Try again." }, { status: 502 });
  }
}
