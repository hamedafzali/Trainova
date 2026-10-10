import { NextResponse } from "next/server";
import { aiConfigured } from "@/server/aiConfig";

export const dynamic = "force-dynamic";

/** Whether the AI coach can be used. Public: reveals nothing but a boolean. */
export async function GET() {
  return NextResponse.json({ available: aiConfigured() }, { headers: { "cache-control": "no-store" } });
}
