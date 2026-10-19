// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { cspFor, middleware } from "./middleware";

describe("cspFor", () => {
  it("allows scripts only by nonce, never inline or eval in production", () => {
    const csp = cspFor("abc");
    const script = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(script).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("adds 'unsafe-eval' only in development", () => {
    expect(cspFor("abc", true)).toContain("'unsafe-eval'");
    expect(cspFor("abc", false)).not.toContain("'unsafe-eval'");
  });
});

describe("middleware", () => {
  it("sends a fresh nonce on each page response", () => {
    const nonceOf = () =>
      middleware(new NextRequest("http://localhost/"))
        .headers.get("Content-Security-Policy")
        ?.match(/'nonce-([^']+)'/)?.[1];
    const a = nonceOf();
    const b = nonceOf();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
