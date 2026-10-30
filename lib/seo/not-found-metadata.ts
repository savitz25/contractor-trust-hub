import type { Metadata } from "next";

/**
 * Leaf metadata for a genuine HTTP 404.
 * Next merges this after the root layout and replaces robots and alternates.
 * The error shell still emits a bare noindex tag before these tags stream in.
 * Canonical is null so the homepage canonical is not inherited.
 */
const notFoundRobots = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
  },
} as const;

export const notFoundPageMetadata: Metadata = {
  title: "Page not found",
  description: "That URL is not in Contractor Trust Hub.",
  robots: notFoundRobots,
  alternates: { canonical: null },
  openGraph: {
    title: "Page not found",
    description: "That URL is not in Contractor Trust Hub.",
  },
};

/** Tags Next appends after the not-found shell's initial noindex meta. */
export function streamedNotFoundHead(
  metadata: Metadata = notFoundPageMetadata,
): string {
  const robots = metadata.robots;
  if (!robots || typeof robots !== "object") {
    throw new Error("not-found robots must be an object");
  }
  const googleBot = "googleBot" in robots ? robots.googleBot : undefined;
  if (!googleBot || typeof googleBot !== "object") {
    throw new Error("not-found googleBot must be an object");
  }
  const robotsContent = `${robots.index ? "index" : "noindex"}, ${robots.follow ? "follow" : "nofollow"}`;
  const googlebotContent = `${googleBot.index ? "index" : "noindex"}, ${googleBot.follow ? "follow" : "nofollow"}`;
  const canonical = metadata.alternates?.canonical;
  const parts = [
    '<meta name="robots" content="noindex"/>',
    `<meta name="robots" content="${robotsContent}"/>`,
    `<meta name="googlebot" content="${googlebotContent}"/>`,
  ];
  if (typeof canonical === "string" && canonical.length > 0) {
    parts.push(`<link rel="canonical" href="${canonical}"/>`);
  }
  return parts.join("");
}
