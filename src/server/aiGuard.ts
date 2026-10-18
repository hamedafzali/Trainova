import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { checkRateLimit } from "@/server/rateLimit";
import { getSessionUser, type SessionUser } from "@/server/session";

type AiUser = SessionUser;

const MAX_REQUESTS_PER_MINUTE = 20;
const DEFAULT_DAILY_BUDGET = 200;

function dailyBudget(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_BUDGET;
}

function fail(status: number, code: string, error: string, headers?: Record<string, string>) {
  return { response: NextResponse.json({ error, code }, { status, headers }) };
}

/**
 * Authenticates, checks AI data-sharing consent and rate-limits AI calls at the
 * server boundary. Limits are shared across instances through Redis (with an
 * in-process fallback): a short burst window plus a per-user daily budget.
 */
export async function authorizeAiRequest(
  request: Request,
): Promise<{ user: AiUser } | { response: NextResponse }> {
  const user = await getSessionUser(request);
  if (!user) return fail(401, "UNAUTHORIZED", "Sign in to use AI.");

  const pool = getPool();
  if (pool) {
    const r = await pool.query("select ai_consent_at from users where id = $1", [user.userId]);
    if (!r.rows[0]?.ai_consent_at) {
      return fail(403, "AI_CONSENT_REQUIRED", "Allow AI data sharing in Profile to use the AI coach.");
    }
  }

  if (await checkRateLimit(`ratelimit:ai:min:${user.userId}`, { windowMs: 60_000, max: MAX_REQUESTS_PER_MINUTE })) {
    return fail(429, "RATE_LIMITED", "Too many AI requests. Try again in a minute.", { "retry-after": "60" });
  }
  const day = new Date().toISOString().slice(0, 10);
  if (await checkRateLimit(`ratelimit:ai:day:${day}:${user.userId}`, { windowMs: 86_400_000, max: dailyBudget() })) {
    return fail(429, "DAILY_LIMIT", "You've reached today's AI limit. It resets tomorrow.");
  }

  return { user };
}

export function isAuthorizedAiRequest(
  result: Awaited<ReturnType<typeof authorizeAiRequest>>,
): result is { user: AiUser } {
  return "user" in result;
}
