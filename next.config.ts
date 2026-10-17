import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { isProductionDeploy } from "./src/lib/deploy";
import { headersFor } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Lets the ads e2e suite build into its own folder (see playwright.ads.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: headersFor(
          isProductionDeploy({ NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV }),
        ),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
