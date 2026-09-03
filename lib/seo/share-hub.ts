/**
 * SHARE-002 — Contractor Trust Hub social-share identity (repo-local).
 * Production canonical + default card must never drift to localhost,
 * a Vercel preview host, or another TrustHub domain.
 */

export const SHARE_HUB = {
  id: "contractor",
  brand: "Contractor Trust Hub",
  host: "www.contractortrusthub.com",
  apexHost: "contractortrusthub.com",
  origin: "https://www.contractortrusthub.com",
  ogImagePath: "/opengraph-image",
  ogImageVersion: "20260903share004b-final",
  ogWidth: 1200,
  ogHeight: 630,
  ogAlt:
    "ContractorTrustHub — independent contractor license research from the Ask Trust Hub Network",
  twitterCard: "summary_large_image",
  networkLabel: "ASK TRUST HUB NETWORK",
} as const;

export const FOREIGN_TRUSTHUB_HOSTS = [
  "www.asktrusthub.com",
  "asktrusthub.com",
  "www.movetrusthub.com",
  "movetrusthub.com",
  "www.insurancetrusthub.com",
  "insurancetrusthub.com",
  "www.lendertrusthub.com",
  "lendertrusthub.com",
  "www.seniortrusthub.com",
  "seniortrusthub.com",
  "www.investortrusthub.com",
  "investortrusthub.com",
] as const;

export function isForbiddenShareHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  return (FOREIGN_TRUSTHUB_HOSTS as readonly string[]).includes(host);
}

export function resolveShareOrigin(): string {
  return SHARE_HUB.origin;
}

export function shareOgImageAbsoluteUrl(origin: string = SHARE_HUB.origin): string {
  return `${origin.replace(/\/$/, "")}${SHARE_HUB.ogImagePath}?v=${SHARE_HUB.ogImageVersion}`;
}

/** Stable contextual OG URL. Nested opengraph-image.tsx paths are hashed by Next and 404. */
export function shareRouteOgImage(routePath: string, alt?: string) {
  const path = (routePath.startsWith("/") ? routePath : `/${routePath}`).replace(/\/$/, "");
  return {
    url: `${SHARE_HUB.origin}${path}/share-og`,
    width: SHARE_HUB.ogWidth,
    height: SHARE_HUB.ogHeight,
    alt: alt || SHARE_HUB.ogAlt,
  };
}
