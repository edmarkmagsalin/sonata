import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@workspace/ui"],
}

export default nextConfig
