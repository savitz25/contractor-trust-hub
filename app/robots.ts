import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteHost, getSiteUrl } from "@/lib/site";

/**
 * Always resolve at request time so Host/Sitemap use the custom domain,
 * not a Vercel preview URL baked at build time.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Touch getSiteUrl so misconfiguration is obvious in logs if needed
  void getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Personalized / utility surfaces — still crawlable via follow, low value to index
        disallow: ["/api/", "/plan/results", "/from-ask"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteHost(),
  };
}
