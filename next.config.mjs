/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the Docker runner image stays tiny.
  output: "standalone",
  experimental: {
    typedRoutes: false,
    // Required for instrumentation.ts (startup fail-fast checks) to load.
    instrumentationHook: true,
  },
};

export default nextConfig;
