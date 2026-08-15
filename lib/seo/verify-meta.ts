import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

const BY_SLUG: Record<string, { title: string; description: string; path: string }> = {
  fl: {
    title: "Verify a Florida contractor",
    description:
      "Search Florida contractor licenses by name or license number. Official DBPR status, Sunbiz entity links, and board discipline — free Trust Reports, not a marketplace.",
    path: "/verify",
  },
  tx: {
    title: "Verify a Texas specialty contractor (TDLR + TSBPE)",
    description:
      "Search Texas TDLR specialty trades and TSBPE plumbing licenses. Not a statewide general contractor directory. Evidence only — not a marketplace.",
    path: "/verify?state=tx",
  },
  nj: {
    title: "Verify a New Jersey HIC or specialty contractor",
    description:
      "Search New Jersey Home Improvement Contractor (HIC) registrations and available specialty boards. No statewide general contractor license. Evidence only — not a marketplace.",
    path: "/verify?state=nj",
  },
  or: {
    title: "Verify an Oregon contractor (CCB)",
    description:
      "Search Oregon Construction Contractors Board active licenses by number or business name. Bond and insurance fields as published. Evidence only — not a marketplace.",
    path: "/verify?state=or",
  },
  ca: {
    title: "Verify a California contractor (CSLB)",
    description:
      "Search California CSLB licenses from official public list extracts for high-impact counties. Always confirm on CSLB Instant License Check. Evidence only — not a marketplace.",
    path: "/verify?state=ca",
  },
  az: {
    title: "Verify an Arizona contractor (ROC)",
    description:
      "Search Arizona Registrar of Contractors licenses from the official current active posting list. Always confirm on ROC contractor search. Evidence only — not a marketplace.",
    path: "/verify?state=az",
  },
  wa: {
    title: "Verify a Washington contractor (L&I)",
    description:
      "Search Washington L&I contractor licenses by number or business name. Always confirm on L&I Verify. Evidence only — not a marketplace.",
    path: "/verify?state=wa",
  },
  la: {
    title: "Verify a Louisiana contractor (LSLBC)",
    description:
      "Search Louisiana State Licensing Board for Contractors licenses by number or business name. Official public roster. Evidence only — not a marketplace.",
    path: "/verify?state=la",
  },
  ms: {
    title: "Verify a Mississippi contractor (MSBOC)",
    description:
      "Search Mississippi State Board of Contractors licenses by number or business name. Official public list. Evidence only — not a marketplace.",
    path: "/verify?state=ms",
  },
  ky: {
    title: "Verify a Kentucky specialty contractor (DHBC)",
    description:
      "Search Kentucky DHBC electrical, HVAC, and plumbing contractor credentials. No statewide general contractor license. Evidence only — not a marketplace.",
    path: "/verify?state=ky",
  },
};

/** Index the clean Verify URL. Search-query and work-filter URLs are thin duplicates — noindex. */
export function verifyMetadata(stateSlug: string, query?: string, work?: string): Metadata {
  const row = BY_SLUG[stateSlug] || BY_SLUG.fl;
  const q = (query || "").trim();
  const w = (work || "").trim();
  return pageMetadata({
    title: row.title,
    description: row.description,
    path: row.path,
    noIndex: q.length > 0 || w.length > 0,
  });
}
