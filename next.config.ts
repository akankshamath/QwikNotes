import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
