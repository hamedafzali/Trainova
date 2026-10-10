import { NextResponse } from "next/server";

/**
 * AI is a runtime switch: it is on whenever the server has a Mistral key
 * (set in the deployment's environment, e.g. ACM project settings). No
 * rebuild is needed to turn it on or off.
 */
export function aiConfigured(): boolean {
  const key = process.env.MISTRAL_API_KEY?.trim() ?? "";
  // Copied-over example values ("your-mistral-api-key-here") don't count.
  return key.length >= 20 && !/^your[-_]|placeholder|changeme|example/i.test(key);
}

export function aiDisabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "The AI coach isn't configured on this server.", code: "AI_DISABLED" },
    { status: 503 },
  );
}
