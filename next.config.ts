import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Set the correct workspace root to silence the lockfile warning
    root: path.resolve(__dirname),
  },
  webpack: (config, { isServer }) => {
    // Exclude mcp-server directory from webpack build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/mcp-server/**', '**/docs/**', '**/node_modules/**'],
    };
    return config;
  },
};

export default nextConfig;
