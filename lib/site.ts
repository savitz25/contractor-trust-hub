/**
 * Canonical public origin for metadata, sitemaps, robots, and absolute URLs.
 *
 * IMPORTANT: Do NOT fall back to VERCEL_URL. Preview deployment hosts get baked
 * into robots.txt / Open Graph at build time and break custom-domain SEO.
 */

/** Production custom domain (www is canonical). */
export const PRODUCTION_SITE_URL = "https://www.contractortrusthub.com";
export const PUBLIC_CONTACT_EMAIL = "hello@asktrusthub.com";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = fromEnv && fromEnv.length > 0 ? fromEnv : PRODUCTION_SITE_URL;

  // Normalize accidental trailing slash
  let url = raw.replace(/\/$/, "");

  // Prefer www on our production host if someone set apex-only
  if (url === "https://contractortrusthub.com" || url === "http://contractortrusthub.com") {
    url = PRODUCTION_SITE_URL;
  }

  // Never emit Vercel preview hosts as the public site URL
  if (url.includes(".vercel.app")) {
    url = PRODUCTION_SITE_URL;
  }

  return url;
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Hostname only (e.g. www.contractortrusthub.com) for robots Host. */
export function getSiteHost(): string {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return "www.contractortrusthub.com";
  }
}
