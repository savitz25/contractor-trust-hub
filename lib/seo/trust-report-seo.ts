import type { Metadata } from "next";
import { statusLabel } from "@/lib/contractors/format";
import type { ContractorDetail } from "@/lib/contractors/types";
import { occupationLabel } from "@/lib/states/config";
import {
  boardShortLabel,
  evidenceSlugFromHomeState,
  sourceExtractLabel,
  trustReportTitleSuffix,
} from "@/lib/states/evidence-copy";
import { pageMetadata } from "@/lib/seo/page-meta";
import { shareRouteOgImage } from "@/lib/seo/share-hub";
import { absoluteUrl } from "@/lib/site";

/** Unique title + description + OG for an indexable Trust Report. */
export function trustReportMetadata(c: ContractorDetail): Metadata {
  const slug = evidenceSlugFromHomeState(c.homeState);
  const lic = c.licenses[0];
  const occ = lic ? occupationLabel(lic.occupationCode) : "construction credential";
  const status = lic ? statusLabel(lic.statusNormalized) : "status unknown";
  const city = c.primaryCity ? ` in ${c.primaryCity}` : "";
  const cred = lic?.licenseNumber || lic?.externalKey || null;
  const path = `/contractors/${encodeURIComponent(c.slug)}`;
  const extract = sourceExtractLabel(slug);

  const description = [
    `Trust Report for ${c.displayName}${city}.`,
    cred ? `${occ} ${cred} — ${status}.` : `Published ${occ} when linked.`,
    `Source: ${extract}.`,
    "Evidence from official public records — not a ranking, marketplace, or endorsement.",
  ].join(" ");

  const og = shareRouteOgImage(
    path,
    `${c.displayName} — contractor license research on ContractorTrustHub`,
  );

  return pageMetadata({
    title: `${c.displayName} — ${trustReportTitleSuffix(slug)}`,
    description,
    path,
    ogType: "profile",
    images: [og.url],
    ogAlt: og.alt,
  });
}

/**
 * ProfilePage + Organization. License id as identifier.
 * Never emit AggregateRating, reviews, or “best of.”
 */
export function trustReportJsonLd(c: ContractorDetail, path: string): Record<string, unknown> {
  const slug = evidenceSlugFromHomeState(c.homeState);
  const lic = c.licenses[0];
  const cred = lic?.licenseNumber || lic?.externalKey || null;
  const region = (c.homeState || "").toUpperCase() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${c.displayName} — ${trustReportTitleSuffix(slug)}`,
    url: absoluteUrl(path),
    description: `Independent ${boardShortLabel(slug)} evidence report for ${c.displayName}. Public-record research — not a ranking or endorsement.`,
    mainEntity: {
      "@type": "Organization",
      name: c.displayName,
      legalName: c.legalName || undefined,
      address:
        c.primaryCity || c.primaryCounty || region
          ? {
              "@type": "PostalAddress",
              addressLocality: c.primaryCity || undefined,
              addressRegion: region,
              addressCountry: "US",
            }
          : undefined,
      identifier: cred
        ? {
            "@type": "PropertyValue",
            name: `${boardShortLabel(slug)} credential`,
            value: cred,
          }
        : undefined,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "Contractor Trust Hub",
      url: absoluteUrl("/"),
    },
  };
}
