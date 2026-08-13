export type GuideMeta = {
  slug: string;
  path: string;
  title: string;
  /** Browser / OG title (can include site context). */
  seoTitle: string;
  description: string;
  kicker: string;
  /** One-line intent for the guides index */
  intent: string;
  publishedAt: string;
  updatedAt: string;
};

export const GUIDES: GuideMeta[] = [
  {
    slug: "how-to-verify-florida-contractor",
    path: "/guides/how-to-verify-florida-contractor",
    title: "How to verify a contractor in Florida",
    seoTitle: "How to Verify a Contractor in Florida (2026)",
    description:
      "A practical Florida homeowner checklist: license status, license class, Sunbiz entity, discipline, and workers’ comp — plus how to use Contractor Trust Hub. Evidence only, not a marketplace.",
    kicker: "Florida · before you hire",
    intent: "Check someone you already have in mind",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
  },
  {
    slug: "florida-contractor-red-flags",
    path: "/guides/florida-contractor-red-flags",
    title: "Red flags when hiring a Florida contractor",
    seoTitle: "Red Flags When Hiring a Florida Contractor",
    description:
      "Warning signs before you hire a Florida contractor — unlicensed work, pressure tactics, vague contracts, and no permit talk. What public records can and cannot show. Not a ranking list.",
    kicker: "Florida · risk education",
    intent: "Spot problems before you sign",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
  },
  {
    slug: "florida-contractor-license-types",
    path: "/guides/florida-contractor-license-types",
    title: "Florida contractor license types explained",
    seoTitle: "Florida Contractor License Types Explained (CBC, CGC, CRC, CCC)",
    description:
      "Plain-language guide to common Florida DBPR construction license classes — CBC, CGC, CRC, CCC/RR, CFC, CAC, and more. What each typically covers. Educational only.",
    kicker: "Florida · license classes",
    intent: "Understand what a license class allows",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
  },
];

export function getGuideBySlug(slug: string): GuideMeta | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

export function listGuides(): GuideMeta[] {
  return GUIDES;
}
