/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the Docker runner image stays tiny.
  output: "standalone",
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
