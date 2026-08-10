import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingest Python scripts are offline tooling — not part of the web bundle.
  outputFileTracingExcludes: {
    "*": ["./data/**", "./ingest/**", "./schema/**", "./scripts/**"],
  },
};

export default nextConfig;
