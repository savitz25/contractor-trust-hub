import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingest Python scripts are offline tooling — not part of the web bundle.
  outputFileTracingExcludes: {
    "*": ["./data/**", "./ingest/**", "./schema/**", "./scripts/**"],
  },
  outputFileTracingIncludes: {
    "/texas/austin": ["./lib/texas-intelligence/local/identity-index.json"],
    "/washington": ["./lib/washington-intelligence/identity-index.json"],
  },
  // Do not externalize "server-only" — Next resolves it via react-server conditions.
  // Listing it here breaks Turbopack SSR with client-component boundaries.
  serverExternalPackages: ["pg"],
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
