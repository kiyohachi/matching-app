import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // ビルド時のESLintチェックを完全に無効化
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ビルド時のTypeScriptチェックも無効化
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
