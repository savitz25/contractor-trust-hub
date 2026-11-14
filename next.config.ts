import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingest Python scripts are offline tooling — not part of the web bundle.
  outputFileTracingExcludes: {
    "*": ["./data/**", "./ingest/**", "./schema/**", "./scripts/**"],
  },
  outputFileTracingIncludes: {
    "/texas/austin": ["./lib/texas-intelligence/local/identity-index.json"],
    "/washington": ["./lib/washington-intelligence/identity-index.json"],
    "/colorado": ["./lib/colorado-intelligence/ec-pc-identity-index.json"],
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
      // Unsuffixed county aliases were soft 404s. Only the four published pages exist.
      { source: "/new-jersey/monmouth", destination: "/new-jersey/monmouth-county", statusCode: 301 },
      { source: "/new-jersey/middlesex", destination: "/new-jersey/middlesex-county", statusCode: 301 },
      { source: "/new-jersey/union", destination: "/new-jersey/union-county", statusCode: 301 },
      { source: "/new-jersey/somerset", destination: "/new-jersey/somerset-county", statusCode: 301 },
    ];
  },
  async rewrites() {
    return [
      // Immutable generation children keep the generation id in the cache key.
      {
        source: "/sitemap/g/:generationId/:shardNo.xml",
        destination: "/sitemap/g/:generationId/:shardNo",
      },
      // Public shards use .xml extension; handlers live at /sitemap/:id
      {
        source: "/sitemap/:id.xml",
        destination: "/sitemap/:id",
      },
    ];
  },
};

export default nextConfig;
