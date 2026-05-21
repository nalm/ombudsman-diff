import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // collect.mjs를 Vercel 배포 번들에 포함
  outputFileTracingIncludes: {
    "/api/collect": ["./scripts/**/*"],
  },
};

export default nextConfig;
