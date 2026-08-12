import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingest Python scripts are offline tooling — not part of the web bundle.
  outputFileTracingExcludes: {
    "*": ["./data/**", "./ingest/**", "./schema/**", "./scripts/**"],
  },
  serverExternalPackages: ["pg", "server-only"],
  async redirects() {
    return [
      // Canonical host: www (apex → www). Requires both hosts on Vercel.
      {
        source: "/:path*",
        has: [{ type: "host", value: "contractortrusthub.com" }],
        destination: "https://www.contractortrusthub.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // Public shards use .xml extension; handlers live at /sitemap/:id
      {
        source: "/sitemap/:id.xml",
        destination: "/sitemap/:id",
      },
    ];
  },
};

export default nextConfig;
