import { NextResponse } from "next/server";
import { bearer, verifyToken } from "@/server/auth";

type AiUser = {
  userId: string;
  email: string;
  role: string;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requests = new Map<string, { count: number; resetAt: number }>();

/**
 * Authenticates and rate-limits AI calls at the server boundary. AI endpoints
 * must never depend on client-side localStorage helpers for authorization.
 */
export async function authorizeAiRequest(
  request: Request,
): Promise<{ user: AiUser } | { response: NextResponse }> {
  const token = bearer(request);
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Sign in to use AI.", code: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  const now = Date.now();
  const entry = requests.get(user.userId);
  if (!entry || now >= entry.resetAt) {
    requests.set(user.userId, { count: 1, resetAt: now + WINDOW_MS });
    return { user };
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return {
      response: NextResponse.json(
        { error: "Too many AI requests. Try again in a minute.", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)) },
        },
      ),
    };
  }

  return { user };
}

export function isAuthorizedAiRequest(
  result: Awaited<ReturnType<typeof authorizeAiRequest>>,
): result is { user: AiUser } {
  return "user" in result;
}
