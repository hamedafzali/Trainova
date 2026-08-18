import { getRedisClient } from "@/lib/cache/redisClient";

/**
 * Redis-backed fixed-window rate limiter (INCR + EXPIRE). Shared across
 * server instances and survives process restarts, unlike an in-memory Map.
 *
 * Fails open: if Redis is unavailable, the call is allowed through and the
 * error is logged. A Redis outage should degrade auth to "unprotected" for
 * brute force, not lock every user out of login/signup.
 */
export async function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number }
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, opts.windowMs);
    }
    return count > opts.max;
  } catch (error) {
    console.error("Rate limit check error:", error);
    return false;
  }
}

/**
 * Clears a rate-limit key (e.g. on a successful login) so the window resets
 * immediately instead of waiting out the full TTL.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    console.error("Rate limit reset error:", error);
  }
}
