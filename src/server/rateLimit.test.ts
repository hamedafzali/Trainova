// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache/redisClient", () => ({
  getRedisClient: () => {
    throw new Error("redis down");
  },
}));

import { checkRateLimit, clientIp } from "./rateLimit";

describe("checkRateLimit without Redis", () => {
  it("still limits, per key, using the in-memory fallback", async () => {
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await checkRateLimit("t:a", { windowMs: 60_000, max: 3 }));
    expect(hits).toEqual([false, false, false, true]);
    expect(await checkRateLimit("t:b", { windowMs: 60_000, max: 3 })).toBe(false);
  });
});

describe("clientIp", () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY;
  });
  const r = () => new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });

  it("ignores spoofable forwarding headers unless a proxy is trusted", () => {
    expect(clientIp(r())).toBe("direct");
    process.env.TRUST_PROXY = "1";
    expect(clientIp(r())).toBe("1.2.3.4");
  });
});
