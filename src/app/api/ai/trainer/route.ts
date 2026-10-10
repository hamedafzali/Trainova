import { NextRequest, NextResponse } from "next/server";
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";
import { aiConfigured, aiDisabledResponse } from "@/server/aiConfig";
import { askTrainer, MAX_MESSAGE_CHARS, parseTrainerContext, type TrainerTurn } from "@/services/ai/trainer";
import { LlmError } from "@/services/ai/llm";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 200_000;

function bad(error: string, status = 400) {
  return NextResponse.json({ error, code: "INVALID_INPUT" }, { status });
}

/** POST { context, messages } → { reply, actions, notice } */
export async function POST(request: NextRequest) {
  if (!aiConfigured()) return aiDisabledResponse();
  const authorization = await authorizeAiRequest(request);
  if (!isAuthorizedAiRequest(authorization)) return authorization.response;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return bad("Request too large.", 413);
  let body: { context?: unknown; messages?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return bad("Invalid JSON.");
  }

  const context = parseTrainerContext(body.context);
  if (!context) return bad("Missing training context.");
  const messages: TrainerTurn[] = Array.isArray(body.messages)
    ? body.messages.flatMap((m) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
          ? [{ role: m.role, content: m.content }]
          : [],
      )
    : [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return bad("The last message must be from you.");
  if (last.content.length > MAX_MESSAGE_CHARS) return bad(`Keep messages under ${MAX_MESSAGE_CHARS} characters.`);

  try {
    return NextResponse.json(await askTrainer(context, messages));
  } catch (e) {
    if (e instanceof LlmError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "AI_UNAVAILABLE" ? 503 : 502 });
    }
    console.error("Trainer error:", e);
    return NextResponse.json({ error: "Something went wrong. Try again.", code: "INTERNAL" }, { status: 500 });
  }
}
