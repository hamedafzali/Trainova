import { chatComplete, isRateLimited } from "./mistralClient";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class LlmError extends Error {
  constructor(
    message: string,
    public code: "AI_UNAVAILABLE" | "BAD_OUTPUT",
  ) {
    super(message);
    this.name = "LlmError";
  }
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && typeof c === "object" && (c as { type?: string }).type === "text" ? (c as { text: string }).text : ""))
      .join("");
  }
  return "";
}

/** Parses a JSON object out of model text (tolerates code fences / leading prose). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : (text.match(/\{[\s\S]*\}/)?.[0] ?? text);
  try {
    const v = JSON.parse(candidate);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** One chat completion in JSON mode. Throws LlmError on outage or unparseable output. */
export async function completeJson(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    const res = await chatComplete(
      {
        messages,
        temperature: opts.temperature ?? 0.4,
        maxTokens: opts.maxTokens ?? 900,
        responseFormat: { type: "json_object" },
      },
      { timeoutMs: opts.timeoutMs ?? 30_000 },
    );
    text = contentText(res.choices?.[0]?.message?.content);
  } catch (e) {
    console.error("LLM call failed:", e instanceof Error ? e.message : e);
    if (isRateLimited(e)) {
      throw new LlmError("The coach is busy right now. Try again in a few seconds.", "AI_UNAVAILABLE");
    }
    throw new LlmError("The coach is unavailable right now. Try again in a moment.", "AI_UNAVAILABLE");
  }
  const parsed = parseJsonObject(text);
  if (!parsed) throw new LlmError("The coach gave an unreadable answer. Try rephrasing.", "BAD_OUTPUT");
  return parsed;
}
