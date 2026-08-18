import { absoluteUrl, getSiteUrl } from "@/lib/site";

/** Serialize JSON-LD without breaking out of the script tag. */
function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson(data) }}
    />
  );
}

/** Sitewide Organization + WebSite (honest — no AggregateRating). */
export function SitewideJsonLd() {
  const site = getSiteUrl();
  const orgId = `${site}/#organization`;
  const websiteId = `${site}/#website`;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Contractor Trust Hub",
        url: site,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/brand/contractor-trust-hub-logo.svg"),
        },
        description:
          "Independent contractor license and registration research with official board evidence and state-specific depth. Not a marketplace.",
        parentOrganization: {
          "@type": "Organization",
          "@id": "https://www.asktrusthub.com/#organization",
          name: "Ask Trust Hub",
          url: "https://www.asktrusthub.com",
        },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "Contractor Trust Hub",
        url: site,
        description:
          "Before you hire, verify. Contractor license evidence from official public records — not a marketplace or ranking.",
        publisher: { "@id": orgId },
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${site}/verify?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return <JsonLd data={data} />;
}

export type BreadcrumbItem = { name: string; path?: string };

/** BreadcrumbList JSON-LD for key paths. */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const entry: Record<string, unknown> = {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
      };
      if (item.path) {
        entry.item = absoluteUrl(item.path);
      }
      return entry;
    }),
  };

  return <JsonLd data={data} />;
}

/** FAQPage from real on-page Q&A. Do not invent answers. */
export function FaqJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const cleaned = items.filter((i) => i.question.trim() && i.answer.trim());
  if (cleaned.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: cleaned.map((i) => ({
          "@type": "Question",
          name: i.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: i.answer,
          },
        })),
      }}
    />
  );
}
