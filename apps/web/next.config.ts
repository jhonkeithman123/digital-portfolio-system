import type { NextConfig } from "next";
import path from "path";

const { DefinePlugin } = require("webpack");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias["react-router-dom"] = path.resolve(
      __dirname,
      "src/utils/routerCompat.tsx",
    );

    config.plugins = config.plugins || [];
    config.plugins.push(
      new DefinePlugin({
        "import.meta.env": JSON.stringify({
          MODE: dev ? "development" : "production",
          BASE_URL: "/",
          VITE_BASE: "/",
          PUBLIC_URL: "",
          VITE_API_URL:
            process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000",
          VITE_API_BASE_URL:
            process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000",
          VITE_API_URL_LOCAL:
            process.env.NEXT_PUBLIC_API_BASE_LOCAL || "http://localhost:5000",
          REACT_APP_API_URL:
            process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000",
        }),
      }),
    );

    return config;
  },
};

export default nextConfig;
