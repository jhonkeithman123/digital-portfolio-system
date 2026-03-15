import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      "react-router-dom": "./src/utils/routerCompat.tsx",
    },
  },
};

export default nextConfig;
