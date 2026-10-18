import { getRedisClient } from "@/lib/cache/redisClient";

/**
 * Fixed-window rate limiter (INCR + PEXPIRE) shared across instances via
 * Redis. If Redis is unreachable it falls back to a per-process window rather
 * than failing open, so brute-force protection never silently disappears.
 */
const local = new Map<string, { count: number; resetAt: number }>();

function localHit(key: string, windowMs: number): number {
  const now = Date.now();
  if (local.size > 10_000) {
    for (const [k, v] of local) if (v.resetAt <= now) local.delete(k);
  }
  const entry = local.get(key);
  if (!entry || entry.resetAt <= now) {
    local.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

/** Records a hit; returns true when the caller is over the limit. */
export async function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number }
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, opts.windowMs);
    return count > opts.max;
  } catch {
    return localHit(key, opts.windowMs) > opts.max;
  }
}

/** Clears a key (e.g. after a successful login). */
export async function resetRateLimit(key: string): Promise<void> {
  local.delete(key);
  try {
    await getRedisClient().del(key);
  } catch {
    /* fallback window already cleared */
  }
}

/**
 * Client address for rate-limit keys. Forwarding headers are only honoured
 * when TRUST_PROXY=1 (i.e. a reverse proxy we control overwrites them);
 * otherwise any client could rotate them to dodge limits. Without a trusted
 * proxy there is no reliable per-IP signal, so per-account keys carry the load.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  }
  return "direct";
}
