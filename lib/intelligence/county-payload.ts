/**
 * Pure Contractor County Intelligence payload builder.
 * Living numbers are injected by the snapshot loader. Page copy does not hardcode counts.
 */
import {
  FLORIDA_COUNTY_INTEL_CATALOG,
  LOCAL_CREDENTIAL_CURRENTNESS,
  PERMIT_MODULE_SLOTS,
} from "./county-catalog";
import { COUNTY_INTELLIGENCE_EDUCATION } from "./county-education";
import {
  countyResearchCoverage,
  evaluateEnhancedLocalResearchGate,
  type FloridaCountyIntelSlug,
} from "./coverage";
import type { IntelligenceEducationModule } from "./education";
import { FLORIDA_CILB_OCCUPATIONS, INTELLIGENCE_TRADE_BUCKETS } from "./occupations";
import { shouldRenderConsumerMetric, type MetricReadiness } from "./readiness";
import type { IntelligenceCategory, IntelligenceCategorySplit } from "./payload-types";
import type { MetricPublicEligibility } from "./types";

export const CTH_FL_COUNTY_INTEL_VERSION = "cth-fl-county-intel-v1";

export type CountyIntelModuleId =
  | "county_address_credentials"
  | "trade_categories"
  | "jurisdiction_metadata"
  | "permits"
  | "local_credentials"
  | "regulatory"
  | "contacts"
  | "operating_activity";

export type CountyIntelModuleStatus = {
  id: CountyIntelModuleId;
  label: string;
  readiness: MetricReadiness;
  publicEligibility: MetricPublicEligibility;
  note: string;
};

export type CountyIntelMetric = {
  id: string;
  label: string;
  value: number | null;
  readiness: MetricReadiness;
  publicEligibility: MetricPublicEligibility;
  disclosure: string;
  geographicScope:
    | "county_mailing_address"
    | "jurisdiction_metadata"
    | "unattributed"
    | "confirmed_issued_permit_activity";
};

export type CountyJurisdictionCensus = {
  datasetPresent: boolean;
  totalMapped: number | null;
  municipalCount: number | null;
  unincorporatedCount: number | null;
  actualDataCoverageCount: number | null;
  disclosure: string;
};

export type CountySourceEntry = {
  id: string;
  agency: string;
  label: string;
  contribution: "contributing" | "requested_pending";
  whatItContains: string;
  limitation: string;
  requestId?: string;
};

export type CountyMoveLikePayload = {
  state: "florida";
  countySlug: FloridaCountyIntelSlug;
  countyName: string;
  canonicalPath: string;
  version: string;
  generatedAt: string;
  asOf: string | null;
  timedOut: boolean;
  coverageLevel: "statewide" | "enhanced";
  coverageLabel: string;
  enhancedGateDocumented: boolean;
  enhancedGateActivated: boolean;
  addressFieldSemantics: string;
  heroIntro: string;
  metrics: CountyIntelMetric[];
  categories: IntelligenceCategory[];
  modules: CountyIntelModuleStatus[];
  jurisdictions: CountyJurisdictionCensus;
  jurisdictionDisclosures: string[];
  evidenceSources: CountySourceEntry[];
  education: IntelligenceEducationModule[];
  discoveryLinks: Array<{ label: string; href: string; semantics: string }>;
  permitModuleSlots: readonly string[];
  localCredentialStatuses: readonly string[];
};

export type CountyLiveCounts = {
  tracked: number | null;
  active: number | null;
  tradeTracked: number | null;
  tradeActive: number | null;
  asOf: string | null;
  occupationRows: Array<{ occupation_code: string; tracked: number; active: number }>;
  jurisdictionRows: Array<{ kind: string; n: number }> | null;
  permitRows: number | null;
  localCredentialRows: number | null;
  contactRows: number | null;
  sourceFileRows: number | null;
  permitEvidence?: {
    sourceRows: number;
    confirmed: number;
    confirmedLast12Months: number;
    distinctLicenses: number;
    unincorporated: number;
    associatedReview: number;
    withValuation: number;
    recordedValuation: number | null;
    contactObservations: number;
    contactDistinctLicenses: number;
  } | null;
};

const CONSUMER_BUCKETS = [
  "general",
  "building",
  "residential",
  "roofing",
  "hvac_air_conditioning",
  "plumbing",
  "mechanical",
  "pool_spa",
  "underground_utility",
  "specialty_structure",
  "solar",
] as const;

const BUCKET_TO_TRADE_SLUG: Record<(typeof CONSUMER_BUCKETS)[number], string> = {
  general: "general-contractors",
  building: "building-contractors",
  residential: "residential-contractors",
  roofing: "roofers",
  hvac_air_conditioning: "air-conditioning",
  plumbing: "plumbing",
  mechanical: "mechanical",
  pool_spa: "pool-spa",
  underground_utility: "underground-utility",
  specialty_structure: "specialty-structures",
  solar: "solar",
};

const BUCKET_LABEL: Record<(typeof CONSUMER_BUCKETS)[number], string> = {
  general: "General",
  building: "Building",
  residential: "Residential",
  roofing: "Roofing",
  hvac_air_conditioning: "HVAC",
  plumbing: "Plumbing",
  mechanical: "Mechanical",
  pool_spa: "Pool/Spa",
  underground_utility: "Underground Utility",
  specialty_structure: "Specialty",
  solar: "Solar",
};

const PENDING_NOTE = "Local dataset pending. Missing export is not zero events.";

export function buildCountyIntelligencePayload(input: {
  countySlug: FloridaCountyIntelSlug;
  generatedAt: string;
  timedOut: boolean;
  counts: CountyLiveCounts | null;
}): CountyMoveLikePayload {
  const catalog = FLORIDA_COUNTY_INTEL_CATALOG[input.countySlug];
  const coverageLevel = countyResearchCoverage(catalog.slug);
  evaluateEnhancedLocalResearchGate({
    sourceFilesLoaded: false,
    permitOrLocalCredentialCoverage: false,
    identityAttributionValidated: false,
    jurisdictionDenominatorKnown: Boolean(input.counts?.jurisdictionRows?.length),
    recencySufficient: false,
    noCriticalCoverageAmbiguity: false,
    operatingActivityEvidence: false,
  });

  const counts = input.timedOut ? null : input.counts;
  const asOf = counts?.asOf ?? null;
  const tracked = counts?.tracked ?? null;
  const active = counts?.active ?? null;
  const tradeTracked = counts?.tradeTracked ?? null;
  const tradeActive = counts?.tradeActive ?? null;

  const occMap = new Map(
    (counts?.occupationRows || []).map((r) => [
      r.occupation_code.toUpperCase(),
      { tracked: r.tracked, active: r.active },
    ])
  );

  const categories: IntelligenceCategory[] = CONSUMER_BUCKETS.map((bucket) => {
    const codes = INTELLIGENCE_TRADE_BUCKETS[bucket] || [];
    const tradeSlug = BUCKET_TO_TRADE_SLUG[bucket];
    const splits: IntelligenceCategorySplit[] = codes.map((code) => {
      const def = FLORIDA_CILB_OCCUPATIONS[code];
      const n = occMap.get(code) || { tracked: 0, active: 0 };
      return {
        code,
        officialName: def?.officialName || code,
        kind: def?.kind || "other",
        tracked: input.timedOut ? 0 : n.tracked,
        active: input.timedOut ? 0 : n.active,
      };
    });
    return {
      id: `category_${bucket}`,
      slug: tradeSlug,
      label: BUCKET_LABEL[bucket],
      href: `${catalog.canonicalPath}/${tradeSlug}`,
      tracked: input.timedOut ? 0 : splits.reduce((s, x) => s + x.tracked, 0),
      active: input.timedOut ? 0 : splits.reduce((s, x) => s + x.active, 0),
      occupationCodes: codes,
      splits,
      disclosure:
        "DBPR credentials in this occupation bucket whose mailing county_code is this county. Not distinct businesses. Not operating geography.",
    };
  });

  const jurisRows = counts?.jurisdictionRows;
  const datasetPresent = Array.isArray(jurisRows);
  const municipalCount = datasetPresent
    ? jurisRows.filter((r) => r.kind === "municipal").reduce((s, r) => s + r.n, 0)
    : null;
  const unincorporatedCount = datasetPresent
    ? jurisRows
        .filter((r) => r.kind === "unincorporated" || r.kind === "county")
        .reduce((s, r) => s + r.n, 0)
    : null;
  const totalMapped = datasetPresent ? jurisRows.reduce((s, r) => s + r.n, 0) : null;
  const ev = counts?.permitEvidence;
  const mdcPermitsReady = catalog.slug === "miami-dade" && ev != null && ev.confirmed > 0;

  const jurisdictions: CountyJurisdictionCensus = {
    datasetPresent,
    totalMapped,
    municipalCount,
    unincorporatedCount,
    actualDataCoverageCount: mdcPermitsReady ? 1 : 0,
    disclosure: mdcPermitsReady
      ? "Jurisdiction mapping tells us where local research must occur. Confirmed county-issued permit evidence currently covers Unincorporated Miami-Dade (folio 30) plus associated M/MBLD county reviews. That is not 34 municipal permit histories."
      : "Jurisdiction mapping tells us where local research must occur. It does not mean permit activity has been acquired. actualDataCoverageCount is permit/local-credential-loaded AHJs and is currently none.",
  };

  const metrics: CountyIntelMetric[] = input.timedOut
    ? []
    : [
        {
          id: "county_credentials",
          label: `Florida credentials with a mailing/base county of ${catalog.name}`,
          value: tracked,
          readiness: tracked == null ? "NOT_READY" : "READY",
          publicEligibility: "public",
          disclosure: catalog.addressFieldSemantics,
          geographicScope: "county_mailing_address",
        },
        {
          id: "county_active_credentials",
          label: `Active credentials with a mailing/base county of ${catalog.name}`,
          value: active,
          readiness: active == null ? "NOT_READY" : "READY",
          publicEligibility: "public",
          disclosure: "Active is DBPR secondary status Active. Not an active-business count and not local authorization.",
          geographicScope: "county_mailing_address",
        },
        {
          id: "county_trade_credentials",
          label: `Trade credentials with a mailing/base county of ${catalog.name}`,
          value: tradeTracked,
          readiness: tradeTracked == null ? "NOT_READY" : "READY",
          publicEligibility: "public",
          disclosure: "Excludes FRO, CRS1, and PVDR. Still credentials, not companies.",
          geographicScope: "county_mailing_address",
        },
        {
          id: "mapped_local_jurisdictions",
          label: "Mapped local permitting jurisdictions (metadata)",
          value: totalMapped,
          readiness: datasetPresent && totalMapped != null ? "READY" : "NOT_READY",
          publicEligibility: "public",
          disclosure:
            "AHJ metadata rows. Not jurisdictions with permits loaded. Not local credential coverage.",
          geographicScope: "jurisdiction_metadata",
        },
        ...(mdcPermitsReady && ev
          ? [
              {
                id: "confirmed_issued_permits",
                label: "Confirmed Miami-Dade County-issued permit records linked to Florida contractor credentials",
                value: ev.confirmed,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure:
                  "Issued-permit rows from the county RER Open Data table that match an occupation-prefixed DBPR license in our warehouse. Not all Miami-Dade permits. Not municipal histories. Issued is not final. HQ mailing county is a separate layer.",
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
              {
                id: "confirmed_issued_permits_last_12_months",
                label: "Confirmed county-issued permit records in the last 12 months",
                value: ev.confirmedLast12Months,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure:
                  "Subset of confirmed issued rows with issue_date in the last 12 months. The source itself is a rolling ~2-year issued window. No 3-year public count.",
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
              {
                id: "confirmed_linked_dbpr_credentials",
                label: "Distinct Florida credentials linked to confirmed county-issued permits",
                value: ev.distinctLicenses,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure:
                  "Distinct DBPR licenses on confirmed rows. A firm headquartered outside Miami-Dade can appear here. This is not the mailing-county credential census.",
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
              {
                id: "confirmed_issued_unincorporated",
                label: "Confirmed issued records in unincorporated Miami-Dade (folio 30)",
                value: ev.unincorporated,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure: "Folio prefix 30. Not the entire county.",
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
              {
                id: "confirmed_issued_associated_review",
                label: "Confirmed associated county-review (M/MBLD) records",
                value: ev.associatedReview,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure:
                  "County Municipal Approval / associated reviews. Not municipal building-permit history.",
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
              {
                id: "recorded_permit_valuation_coverage",
                label: "Confirmed issued records with recorded permit valuation",
                value: ev.withValuation,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure: `Denominator is ${ev.confirmed.toLocaleString("en-US")} confirmed issued records. Missing valuation is not zero and is not summed.`,
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
              {
                id: "contact_enrichment_coverage",
                label: "Public contact observations from confirmed permit attribution",
                value: ev.contactObservations,
                readiness: "READY" as const,
                publicEligibility: "public" as const,
                disclosure: `Phone and mailing-address observations on ${ev.contactDistinctLicenses.toLocaleString("en-US")} distinct confirmed licenses. Agency numbers excluded. Secondary values are not overwritten.`,
                geographicScope: "confirmed_issued_permit_activity" as const,
              },
            ]
          : [
              {
                id: "permits",
                label: "Local permit records (loaded rows)",
                value: counts?.permitRows ?? null,
                readiness: "INTERNAL_ONLY" as const,
                publicEligibility: "internal_only" as const,
                disclosure: PENDING_NOTE,
                geographicScope: "unattributed" as const,
              },
            ]),
        {
          id: "local_credentials",
          label: "Local county credentials / certifications (loaded rows)",
          value: counts?.localCredentialRows ?? null,
          readiness: "INTERNAL_ONLY",
          publicEligibility: "internal_only",
          disclosure: PENDING_NOTE,
          geographicScope: "unattributed",
        },
        {
          id: "county_enforcement",
          label: "County enforcement actions",
          value: null,
          readiness: "NOT_READY",
          publicEligibility: "internal_only",
          disclosure:
            "Florida DBPR/DFS records are statewide events. A mailing-county association is not “county enforcement.” No public county-level count is published.",
          geographicScope: "unattributed",
        },
        ...(mdcPermitsReady
          ? []
          : [
              {
                id: "contacts",
                label: "County contact observations",
                value: null,
                readiness: "NOT_READY" as const,
                publicEligibility: "internal_only" as const,
                disclosure:
                  "Public county contact metrics are not published. Secondary values are never overwritten.",
                geographicScope: "unattributed" as const,
              },
            ]),
        {
          id: "operating_geography",
          label: "Operating / activity evidence",
          value: null,
          readiness: "NOT_READY",
          publicEligibility: "internal_only",
          disclosure: "Not inferred from mailing county. Blocks Enhanced Local Research.",
          geographicScope: "unattributed",
        },
      ];

  const modules: CountyIntelModuleStatus[] = [
    {
      id: "county_address_credentials",
      label: "State credentials with county mailing/base address",
      readiness: tradeTracked != null ? "READY" : "NOT_READY",
      publicEligibility: "public",
      note: catalog.addressFieldSemantics,
    },
    {
      id: "trade_categories",
      label: "Trade / category split",
      readiness: tradeTracked != null ? "READY" : "NOT_READY",
      publicEligibility: "public",
      note: "Corrected CILB taxonomy. RR is residential, not roofing. CSC is sheet metal, not solar. FRO is not a trade license.",
    },
    {
      id: "jurisdiction_metadata",
      label: "Enhanced jurisdiction metadata",
      readiness: datasetPresent ? "READY" : "NOT_READY",
      publicEligibility: "public",
      note: jurisdictions.disclosure,
    },
    {
      id: "permits",
      label: "Local permits",
      readiness: mdcPermitsReady ? "READY" : "NOT_READY",
      publicEligibility: mdcPermitsReady ? "public" : "internal_only",
      note: mdcPermitsReady
        ? "Confirmed Miami-Dade County-issued permit records linked to Florida contractor credentials. Issued-only rolling ~2-year RER source. Not municipal histories. Not open/pending. REVIEW_REQUIRED and UNRESOLVED are not public contractor activity."
        : PENDING_NOTE,
    },
    {
      id: "local_credentials",
      label: "Local credentials / certifications",
      readiness: "NOT_READY",
      publicEligibility: "internal_only",
      note: PENDING_NOTE,
    },
    {
      id: "regulatory",
      label: "Regulatory & Enforcement History",
      readiness: "NOT_READY",
      publicEligibility: "internal_only",
      note: "No public county-level count is currently published. Statewide observations remain statewide events.",
    },
    {
      id: "contacts",
      label: "Contact enrichment",
      readiness: mdcPermitsReady ? "READY" : "NOT_READY",
      publicEligibility: mdcPermitsReady ? "public" : "internal_only",
      note: mdcPermitsReady
        ? "Public phones and mailing addresses observed on confirmed county-issued permit rows. Agency numbers excluded."
        : "Future county evidence may add multiple phones/emails/addresses without overwriting.",
    },
    {
      id: "operating_activity",
      label: "Operating / activity evidence",
      readiness: "NOT_READY",
      publicEligibility: "internal_only",
      note: "Required for Enhanced. Not inferred from HQ/mailing county.",
    },
  ];

  const evidenceSources: CountySourceEntry[] = [
    {
      id: "fl_dbpr_licensing",
      agency: "Florida DBPR / CILB",
      label: "DBPR construction credentials",
      contribution: "contributing",
      whatItContains: "CILB licensee extract filtered by official mailing county_code for this county.",
      limitation: "Mailing/base county is not jobsites or local licenses.",
    },
    {
      id: "fl_dbpr_regulatory",
      agency: "Florida DBPR / CILB and Florida DFS",
      label: "Statewide regulatory research (context)",
      contribution: "contributing",
      whatItContains:
        "Licensed-contractor discipline, unlicensed activity, Recovery Fund, and DFS workers’ compensation / stop-work observations as statewide research.",
      limitation:
        "These are Florida statewide records. Associating them with a mailing-county population is not county enforcement.",
    },
    {
      id: "jurisdiction_metadata",
      agency: catalog.pendingAgency,
      label: "Mapped local jurisdictions",
      contribution: "contributing",
      whatItContains: "AHJ metadata seed (municipal vs unincorporated). Not permit rows.",
      limitation: "Metadata ≠ permit coverage.",
    },
    ...(mdcPermitsReady
      ? [
          {
            id: "mdc_opendata_issued",
            agency: "Miami-Dade RER GIS / Open Data Hub",
            label: "County-issued building permits (2 prior years to present)",
            contribution: "contributing" as const,
            whatItContains:
              "Issued permits pulled by Miami-Dade County. Confirmed rows are linked to occupation-prefixed DBPR licenses. Unincorporated folio 30 and associated M/MBLD reviews are labeled separately.",
            limitation:
              "Issued-only rolling window. Not open/pending. Not 34 municipal building departments. City of Miami GIS is excluded from public contractor volume.",
          },
        ]
      : []),
    {
      id: "pending_permits",
      agency: catalog.pendingAgency,
      label: mdcPermitsReady ? "Full permit history / open / raw status extract" : "Local permit extract",
      contribution: "requested_pending",
      whatItContains: mdcPermitsReady
        ? "Longer history, open/unfinaled, and raw status beyond the public issued table — requested, not loaded."
        : "Existing electronic permit metadata — requested, not loaded.",
      limitation: PENDING_NOTE,
      requestId: catalog.pendingPermitRequestId,
    },
    {
      id: "pending_local_credentials",
      agency: catalog.pendingAgency,
      label: "Local credential / certification extract",
      contribution: "requested_pending",
      whatItContains: "County certification / enrollment extract — requested, not loaded.",
      limitation: PENDING_NOTE,
      requestId: catalog.pendingCredentialRequestId,
    },
  ];

  return {
    state: "florida",
    countySlug: catalog.slug,
    countyName: catalog.name,
    canonicalPath: catalog.canonicalPath,
    version: CTH_FL_COUNTY_INTEL_VERSION,
    generatedAt: input.generatedAt,
    asOf,
    timedOut: input.timedOut,
    coverageLevel,
    coverageLabel: coverageLevel === "statewide" ? "Statewide Research" : "Enhanced Local Research",
    enhancedGateDocumented: true,
    enhancedGateActivated: false,
    addressFieldSemantics: catalog.addressFieldSemantics,
    heroIntro: catalog.heroIntro,
    metrics,
    categories: input.timedOut ? [] : categories,
    modules,
    jurisdictions,
    jurisdictionDisclosures: catalog.jurisdictionDisclosures,
    evidenceSources,
    education: COUNTY_INTELLIGENCE_EDUCATION,
    discoveryLinks: [
      {
        label: `Browse ${catalog.name} contractors`,
        href: catalog.canonicalPath,
        semantics:
          "Discovery list of Florida DBPR credentials whose mailing county_code is this county — not a service-area directory.",
      },
      {
        label: "Florida State Intelligence",
        href: "/florida",
        semantics: "Statewide credential, category, and regulatory research.",
      },
      {
        label: "Check a license",
        href: "/verify",
        semantics: "Name or full license number lookup.",
      },
    ],
    permitModuleSlots: PERMIT_MODULE_SLOTS,
    localCredentialStatuses: LOCAL_CREDENTIAL_CURRENTNESS,
  };
}

export function publicCountyMetrics(payload: CountyMoveLikePayload): CountyIntelMetric[] {
  return payload.metrics.filter(
    (m) =>
      shouldRenderConsumerMetric({
        readiness: m.readiness,
        publicEligibility: m.publicEligibility,
      }) && m.value != null
  );
}
