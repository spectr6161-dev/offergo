import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@offergo/auth", "@offergo/shared", "@offergo/ui"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
