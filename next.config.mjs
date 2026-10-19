import { fileURLToPath } from "node:url";
import path from "node:path";

// Pages get a nonce-based Content Security Policy from src/middleware.ts.
// API routes return JSON and get this one: no scripts at all.
const strictCsp = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the Docker runner image stays tiny.
  output: "standalone",
  // Pin tracing to this repo; a parent-folder lockfile otherwise confuses it.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: strictCsp }] },
    ];
  },
};

export default nextConfig;
