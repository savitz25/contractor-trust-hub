import { NJ_COUNTY_META, NJ_COUNTY_SLUGS, type NjCountySlug } from "../counties/catalog";
import type { NjCountySnapshot, NjsaviVendorRow } from "../counties/load";
import middlesex from "../counties/middlesex.json";
import monmouth from "../counties/monmouth.json";
import njsavi from "../counties/njsavi-construction-candidates.json";
import somerset from "../counties/somerset.json";
import union from "../counties/union.json";
import { NEW_JERSEY_SNAPSHOT } from "../snapshot";

/** Content change date for the five NJ research URLs. Sitemap lastmod uses this date only. */
export const NJ_CONTENT_LASTMOD = "2026-11-14";

/** Official real-time lookup. This page does not copy the roster. */
export const NJ_HIC_LOOKUP_URL = "https://newjersey.mylicense.com/verification/";

const SNAPSHOTS = {
  "monmouth-county": monmouth,
  "middlesex-county": middlesex,
  "somerset-county": somerset,
  "union-county": union,
} as const;

/** Researched counties that share a border. Other borders are not linked because they have no page. */
const NEIGHBOR_SLUGS: Record<NjCountySlug, readonly NjCountySlug[]> = {
  "monmouth-county": ["middlesex-county"],
  "middlesex-county": ["monmouth-county", "somerset-county", "union-county"],
  "somerset-county": ["middlesex-county", "union-county"],
  "union-county": ["middlesex-county", "somerset-county"],
};

const FOCUS_ORDER: readonly NjCountySlug[] = [
  "monmouth-county",
  "middlesex-county",
  "union-county",
  "somerset-county",
];

export type NjFaq = { question: string; answer: string };

export type NjCountyContent = {
  slug: NjCountySlug;
  name: string;
  title: string;
  description: string;
  vendorCount: number;
  dcaRecords: number;
  permitRecords: number;
  certificateRecords: number;
  profileCount: number;
  municipalities: number;
  reporters: number;
  topTowns: { name: string; permitRecords: number; certificateRecords: number }[];
  commodityCounts: { code: string; count: number }[];
  featuredVendors: { name: string; city: string; category: string }[];
  neighbors: { slug: NjCountySlug; name: string }[];
  coverage: string;
  bulkComplaintRows: number;
  novs: { company: string; town: string; violation: string; penalty: number | null }[];
  faqs: NjFaq[];
  paragraphs: string[];
};

function n(value: number): string {
  return value.toLocaleString("en-US");
}

function snapshotFor(slug: NjCountySlug): NjCountySnapshot {
  return SNAPSHOTS[slug] as NjCountySnapshot;
}

function vendorsFor(countyName: string): NjsaviVendorRow[] {
  const needle = countyName.toUpperCase();
  return njsavi.rows.filter((row) => row.county === needle);
}

export function loadNjCountyContent(slug: NjCountySlug): NjCountyContent {
  const snap = snapshotFor(slug);
  const name = snap.county;
  const vendors = vendorsFor(name);
  const vendorCount = snap.contractor_discovery.njsavi_construction_vendor_candidates;
  const dcaRecords = snap.construction.total_source_records;
  const permitRecords = snap.construction.permit_issued_records;
  const certificateRecords = snap.construction.certificate_issued_records;
  const profileCount = snap.contractor_discovery.public_profiles_with_deterministic_county_address;
  const topTowns = [...snap.municipalities.rows]
    .sort((a, b) => b.permit_issued_records - a.permit_issued_records || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((row) => ({
      name: row.name,
      permitRecords: row.permit_issued_records,
      certificateRecords: row.certificate_issued_records,
    }));
  const counts = new Map<string, number>();
  for (const row of vendors) {
    const code = row.trade_or_category.trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const commodityCounts = [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, 8);
  const featuredVendors = [...vendors]
    .sort((a, b) => a.business_name.localeCompare(b.business_name) || a.business_city.localeCompare(b.business_city))
    .slice(0, 8)
    .map((row) => ({
      name: row.business_name,
      city: row.business_city,
      category: row.trade_or_category,
    }));
  const coverage = snap.regulatory.consumer_affairs.coverage;
  const bulkComplaintRows = snap.regulatory.consumer_affairs.bulk_rows;
  const novs = snap.regulatory.safe_house_novs_in_county.map((row) => ({
    company: row.company,
    town: row.town,
    violation: row.violation,
    penalty: row.penalty_proposed_usd,
  }));
  const townList = topTowns
    .map((town) => `${town.name} (${n(town.permitRecords)} permit-issued, ${n(town.certificateRecords)} certificate-issued)`)
    .join("; ");
  const codeList = commodityCounts
    .slice(0, 3)
    .map((row) => `${row.code} on ${n(row.count)} rows`)
    .join(", ");
  const novSentence = novs.length
    ? novs
        .map(
          (row) =>
            `${name} County inventory includes a Safe House notice of violation for ${row.company} in ${row.town} (${row.violation}${
              row.penalty != null ? `, proposed $${n(row.penalty)}` : ""
            }). A notice is not a final order.`,
        )
        .join(" ")
    : `${name} County has no Safe House notice-of-violation row in this inventory. That is not a statement that no complaint exists.`;
  const paragraphs = [
    `${name} County’s acquired file holds ${n(dcaRecords)} DCA construction source records (${n(permitRecords)} permit-issued and ${n(certificateRecords)} certificate-issued) across ${n(snap.municipalities.canonical_current)} current municipalities, of which ${n(snap.municipalities.observed_reporters)} are observed reporters. Those rows are source records, not contractor licenses and not a count of projects.`,
    `The same ${name} County file holds ${n(vendorCount)} NJSAVI certified-vendor rows whose published business city falls in the county. ${n(profileCount)} ContractorTrustHub public profiles have a deterministic business address in ${name} County. Missing profiles are unknown, not an empty market, and a vendor row is not a Home Improvement Contractor registration.`,
    `The municipalities with the most permit-issued records in the ${name} County extract are ${townList}. A municipality with fewer rows is not a town with less hiring demand.`,
    `NJSAVI commodity codes on the ${name} County vendor rows are filing categories, not roofing, HVAC, plumbing, or electrical license classes. The three most frequent codes in this county file are ${codeList}.`,
    `${name} County consumer-affairs coverage in this snapshot is ${coverage}, with ${n(bulkComplaintRows)} bulk complaint rows held. ${novSentence} A complaint is not a violation, and a missing extract is not a clean record.`,
    `Before hiring for work in ${name} County, look the business up on the New Jersey Division of Consumer Affairs license verification page and read the registration status for that legal name. This research page does not reprint the state roster.`,
  ];
  const faqs: NjFaq[] = [
    {
      question: `How many DCA construction source records does the ${name} County extract hold?`,
      answer: paragraphs[0],
    },
    {
      question: `Which ${name} County municipalities have the most permit-issued records in this extract?`,
      answer: paragraphs[2],
    },
    {
      question: `Does ContractorTrustHub have a ${name} County count of licensed roofers, home-improvement contractors, HVAC, plumbers, or electricians?`,
      answer: `No. The ${name} County snapshot does not include a Division of Consumer Affairs Home Improvement Contractor roster, so it does not publish a license count for roofing, home improvement, HVAC, plumbing, or electrical. Coverage is ${coverage} and bulk complaint rows held are ${n(bulkComplaintRows)}. Verify a business at the official lookup instead of reading a zero on this page as a market size.`,
    },
    {
      question: `What named business activity does the ${name} County file actually contain?`,
      answer: `${paragraphs[1]} ${paragraphs[3]} ${novSentence}`,
    },
  ];
  return {
    slug,
    name,
    title: `${name} County NJ contractors | ${n(vendorCount)} construction vendors on file`,
    description: `${name} County, New Jersey: ${n(vendorCount)} city-matched construction vendors and ${n(dcaRecords)} DCA construction source records in the acquired extract. Not a Home Improvement Contractor roster and not a ranking.`,
    vendorCount,
    dcaRecords,
    permitRecords,
    certificateRecords,
    profileCount,
    municipalities: snap.municipalities.canonical_current,
    reporters: snap.municipalities.observed_reporters,
    topTowns,
    commodityCounts,
    featuredVendors,
    neighbors: NEIGHBOR_SLUGS[slug].map((neighbor) => ({
      slug: neighbor,
      name: NJ_COUNTY_META[neighbor].name,
    })),
    coverage,
    bulkComplaintRows,
    novs,
    faqs,
    paragraphs,
  };
}

export function allNjCountyContent(): NjCountyContent[] {
  return FOCUS_ORDER.map((slug) => loadNjCountyContent(slug));
}

export type NjStatewideCountyRow = {
  name: string;
  slug: NjCountySlug | null;
  permitRecords: number;
  certificateRecords: number;
  reporters: number;
  focus: boolean;
};

export function statewideCountyRows(): NjStatewideCountyRow[] {
  const byName = new Map(NJ_COUNTY_SLUGS.map((slug) => [NJ_COUNTY_META[slug].name.toUpperCase(), slug]));
  const rows = NEW_JERSEY_SNAPSHOT.counties
    .filter((row) => !row.is_state_category)
    .map((row) => {
      const slug = byName.get(row.name) ?? null;
      return {
        name: row.name,
        slug,
        permitRecords: row.permit_issued_records,
        certificateRecords: row.certificate_issued_records,
        reporters: row.observed_municipality_codes,
        focus: slug != null,
      };
    });
  return rows.sort((a, b) => {
    if (a.focus !== b.focus) return a.focus ? -1 : 1;
    if (a.focus && b.focus) return FOCUS_ORDER.indexOf(a.slug!) - FOCUS_ORDER.indexOf(b.slug!);
    return a.name.localeCompare(b.name);
  });
}

export function fourCountyCommodityLeaders(): { code: string; count: number }[] {
  const counts = new Map<string, number>();
  const focus = new Set(NJ_COUNTY_SLUGS.map((slug) => NJ_COUNTY_META[slug].name.toUpperCase()));
  for (const row of njsavi.rows) {
    if (!focus.has(row.county)) continue;
    const code = row.trade_or_category.trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, 5);
}

export function displayCountyName(name: string): string {
  return name.toLowerCase().replace(/(^|\s)\S/g, (chunk) => chunk.toUpperCase());
}

export function newJerseyStateTitle(records: number): string {
  return `New Jersey contractors | ${n(records)} DCA construction source records`;
}

export function newJerseyStateDescription(records: number): string {
  return `New Jersey research for ${n(records)} DCA construction source records, all 21 counties, and the Home Improvement Contractor lookup. The four acquired county files are linked first. Not a ranking or a copied license roster.`;
}

export function countyResearchText(content: NjCountyContent): string {
  return [
    ...content.paragraphs,
    ...content.faqs.flatMap((faq) => [faq.question, faq.answer]),
    ...content.topTowns.map(
      (town) =>
        `${content.name} ${town.name} ${town.permitRecords} permit-issued records and ${town.certificateRecords} certificate-issued records`,
    ),
    ...content.featuredVendors.map(
      (vendor) => `${vendor.name} ${vendor.city} ${content.name} County commodity ${vendor.category}`,
    ),
    content.neighbors
      .map((neighbor) => `${content.name} County research also links to ${neighbor.name} County`)
      .join(". "),
  ].join("\n");
}

export function sharedSentenceShare(texts: readonly string[]): { shared: number; words: number[] } {
  const sentenceSets = texts.map((text) =>
    text
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter((sentence) => sentence.length >= 80),
  );
  return {
    shared: (() => {
      const ratios = sentenceSets.map((sentences, index) => {
        const chars = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
        if (!chars) return 0;
        const sharedChars = sentences.reduce((sum, sentence) => {
          const elsewhere = sentenceSets.some((other, otherIndex) => otherIndex !== index && other.includes(sentence));
          return sum + (elsewhere ? sentence.length : 0);
        }, 0);
        return sharedChars / chars;
      });
      return Math.max(...ratios);
    })(),
    words: texts.map((text) => text.split(/\s+/).filter(Boolean).length),
  };
}
