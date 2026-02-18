import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow server-only env vars to be used in API routes + agents
  serverExternalPackages: [],
};

export default nextConfig;
