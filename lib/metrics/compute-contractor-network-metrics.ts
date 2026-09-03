import { createHash } from "node:crypto";
import type {
  ContractorNetworkMetric,
  ContractorNetworkMetricsV1,
  EvidenceFamilyMetric,
  MetricGrain,
  PublicationStatus,
} from "./contractor-network-metrics-v1";
import { CONTRACTOR_NETWORK_METRICS_VERSION } from "./contractor-network-metrics-v1";

export type NetworkMetricsInput = {
  generatedAt: string;
  liveStateCodes: string[];
  liveSourceSystems: string[];
  licensesBySource: Record<string, number>;
  liveActiveCurrentCredentialRecords: number;
  researchGraphLicenseRecords: number;
  researchGraphContractorIdentities: number;
  contractorEntityLinks: number;
  publicContactObservations: number;
  disciplineActionRows: number;
  regulatoryObservations: number;
  regulatoryOccurrences: number;
  indexedPermitSourceRecords: number;
  evidenceFamilies: EvidenceFamilyMetric[];
  liveStatus: ContractorNetworkMetricsV1["licensingStatus"]["liveCohort"];
  tradeFamilies: ContractorNetworkMetricsV1["tradeFamilies"];
  caProductionCslbRows: number;
  caAcquiredTruncatedRows: number;
  caAcquiredAsOf: string;
  njConstructionSourceRecords: number;
  njConstructionSourceAsOf: string;
  njCurrentMunicipalities: number;
  njMunicipalityAsOf: string;
  njPublishedCountyPages: number;
  njPublicWorksRegulatoryRows: number;
  floridaCountyIntelligencePages: number;
};

function metric(partial: Omit<ContractorNetworkMetric, "unit" | "generatedAt"> & { generatedAt: string }): ContractorNetworkMetric {
  return { unit: "count", ...partial };
}

function sumLive(input: NetworkMetricsInput): number {
  return input.liveSourceSystems.reduce((n, src) => n + Number(input.licensesBySource[src] || 0), 0);
}

export function assertGrainSafety(input: NetworkMetricsInput): void {
  for (const src of input.liveSourceSystems) {
    if (input.licensesBySource[src] == null) {
      throw new Error(`live source omitted from licensesBySource: ${src}`);
    }
  }
  const live = sumLive(input);
  if (input.liveActiveCurrentCredentialRecords > live) {
    throw new Error("active/current exceeds live credentials");
  }
  if (input.caAcquiredTruncatedRows === input.caProductionCslbRows) {
    throw new Error("truncated CSLB extract must not be treated as the production ca_cslb denominator");
  }
  if (input.njConstructionSourceRecords === live) {
    throw new Error("NJ construction source records must not equal live credentials");
  }
  if (input.publicContactObservations === input.researchGraphContractorIdentities && input.publicContactObservations > 0) {
    throw new Error("contacts must not equal contractor identities");
  }
  const countyPages = input.floridaCountyIntelligencePages + input.njPublishedCountyPages;
  if (countyPages === input.liveStateCodes.length) {
    throw new Error("county pages must not be used as live state count");
  }
  const familySum = input.evidenceFamilies.reduce((n, f) => n + f.rows, 0);
  if (familySum !== input.disciplineActionRows) {
    throw new Error(`evidence family sum ${familySum} !== discipline_actions ${input.disciplineActionRows}`);
  }
  if (
    input.disciplineActionRows ===
    input.regulatoryObservations + input.regulatoryOccurrences
  ) {
    throw new Error("discipline actions must not equal observations+occurrences");
  }
}

export function computeContractorNetworkMetrics(input: NetworkMetricsInput): ContractorNetworkMetricsV1 {
  assertGrainSafety(input);
  const generatedAt = input.generatedAt;
  const liveCredentials = sumLive(input);
  const countyPages = input.floridaCountyIntelligencePages + input.njPublishedCountyPages;
  const documentedDates = [
    input.caAcquiredAsOf,
    input.njConstructionSourceAsOf,
    input.njMunicipalityAsOf,
  ].filter(Boolean).sort();
  const newestDocumentedSourceAsOf = documentedDates.at(-1) ?? null;

  const commonTrace = (counts: string, doesNotCount: string, systems: string[], geo: string, sourceDates: string, extra?: Partial<ContractorNetworkMetric["trace"]>) => ({
    counts,
    doesNotCount,
    contributingSourceSystems: systems,
    geographicCoverage: geo,
    sourceDates,
    generationDate: generatedAt.slice(0, 10),
    ...extra,
  });

  const metrics: ContractorNetworkMetric[] = [
    metric({
      key: "live_credential_records",
      label: "Live credential records",
      value: liveCredentials,
      grain: "license_credential_record",
      denominator: "licenses.source_system IN live Verify sources from lib/states/config.ts",
      description: "License/credential rows in the public live researched-state cohort.",
      coverage: input.liveStateCodes.join(", "),
      contributingSourceSystems: input.liveSourceSystems,
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "One row per license/credential in live source systems.",
        "Not contractor entities, permits, construction-source rows, contacts, counties, or the truncated CA CSLB stream.",
        input.liveSourceSystems,
        `${input.liveStateCodes.length} live researched states`,
        "Board extract dates vary by state; not represented by Git or deploy time.",
        { currentActiveRule: "This metric is all live-cohort rows, not only active/current." }
      ),
    }),
    metric({
      key: "live_active_current_credential_records",
      label: "Active/current live credential records",
      value: input.liveActiveCurrentCredentialRecords,
      grain: "license_credential_record_active_current",
      denominator: "live credential records with status_normalized IN (active, current)",
      description: "Subset of the live credential cohort whose normalized status is active or current.",
      coverage: input.liveStateCodes.join(", "),
      contributingSourceSystems: input.liveSourceSystems,
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "Live-cohort license rows with status_normalized active or current.",
        "Not inactive/expired/suspended/revoked rows, and not a count of businesses.",
        input.liveSourceSystems,
        `${input.liveStateCodes.length} live researched states`,
        "Board extract dates vary by state.",
        { currentActiveRule: "status_normalized IN ('active','current')" }
      ),
    }),
    metric({
      key: "live_researched_states",
      label: "Live researched states",
      value: input.liveStateCodes.length,
      grain: "live_researched_state",
      denominator: "EVIDENCE_STATES live:true in LIVE_STATE_ORDER via getLiveStates()",
      description: "Product-configured live Verify states. Not a U.S. contractor census.",
      coverage: input.liveStateCodes.join(", "),
      contributingSourceSystems: input.liveSourceSystems,
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "States currently live in ContractorTrustHub Verify/config.",
        "Not counties, municipalities, or unpublished adapter states (e.g. Wisconsin).",
        ["lib/states/config.ts"],
        input.liveStateCodes.join(", "),
        "Product configuration, not a regulator extract date."
      ),
    }),
    metric({
      key: "research_graph_license_records",
      label: "Research-graph license records",
      value: input.researchGraphLicenseRecords,
      grain: "research_graph_license_record",
      denominator: "all licenses rows across populated source_systems, including non-live adapters",
      description: "Broader research-graph license rows. Not currently public live coverage.",
      coverage: "Populated license source systems including non-live adapters",
      contributingSourceSystems: Object.keys(input.licensesBySource).filter((k) => input.licensesBySource[k] > 0),
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC_RESEARCH_GRAPH",
      trace: commonTrace(
        "Every license row in the research graph.",
        "Not the live public cohort and not a national contractor census.",
        Object.keys(input.licensesBySource).filter((k) => input.licensesBySource[k] > 0),
        "All populated source systems",
        "Board extract dates vary."
      ),
    }),
    metric({
      key: "regulatory_discipline_action_rows",
      label: "Regulatory / enforcement source rows",
      value: input.disciplineActionRows,
      grain: "discipline_action_row",
      denominator: "discipline_actions table",
      description: "Indexed regulatory and enforcement source rows, family-separated. Not a count of bad contractors.",
      coverage: "Florida DBPR/DFS families plus NJ and AZ rows currently indexed",
      contributingSourceSystems: [...new Set(input.evidenceFamilies.map((f) => f.sourceSystem))],
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "discipline_actions rows, attributed to evidence families.",
        "Not observations+occurrences, not credentials, not construction-source records.",
        [...new Set(input.evidenceFamilies.map((f) => f.sourceSystem))],
        "Florida-heavy; NJ and AZ families as indexed",
        "Family source dates vary; not interchangeable severity."
      ),
    }),
    metric({
      key: "indexed_permit_source_records",
      label: "Indexed permit source records",
      value: input.indexedPermitSourceRecords,
      grain: "permit_source_record",
      denominator: "permit_source_records table",
      description: "Permit source records currently indexed in production. Not jobs completed and not NJ construction-source rows.",
      coverage: "Production permit_source_records",
      contributingSourceSystems: ["permit_source_records"],
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "Rows in permit_source_records.",
        "Not NJ DCA construction source records, not credentials, not nationwide permit volume.",
        ["permit_source_records"],
        "Selected indexed permit sources",
        "Permit file dates vary."
      ),
    }),
    metric({
      key: "nj_construction_source_records",
      label: "New Jersey construction source records",
      value: input.njConstructionSourceRecords,
      grain: "municipal_permit_or_certificate_source_record",
      denominator: "NJ DCA construction extract (permit-issued + certificate-issued source records)",
      description: "MARKET_ONLY municipal construction source records. Not contractor credentials and not unique permits/projects.",
      coverage: "New Jersey",
      contributingSourceSystems: ["nj_construction_permits"],
      sourceAsOf: input.njConstructionSourceAsOf,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "Permit-issued and certificate-issued SOURCE RECORDS in the NJ DCA construction extract.",
        "Not licensed contractors, not unique permits, not projects, not credentials.",
        ["nj_construction_permits"],
        "New Jersey municipalities in the extract",
        `Official data received as of ${input.njConstructionSourceAsOf}`
      ),
    }),
    metric({
      key: "published_county_intelligence_pages",
      label: "Published county intelligence pages",
      value: countyPages,
      grain: "published_county_intelligence_page",
      denominator: "Florida county intelligence slugs + published NJ county pages",
      description: "County research pages currently published. Enhanced Local Research gate is not activated; this is not an enhanced-county quality score.",
      coverage: "Florida county intel slugs and four NJ counties",
      contributingSourceSystems: ["florida-county-intel", "nj-county-intel"],
      sourceAsOf: input.njMunicipalityAsOf,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "Published county intelligence routes.",
        "Not live researched states, not municipalities, not Enhanced Local Research (gate not activated), not CA KEEP_DATA_ONLY harvests.",
        ["florida-county-intel", "nj-county-intel"],
        "Selected FL and NJ counties",
        `NJ county publication fingerprints as of ${input.njMunicipalityAsOf}; FL county pages are statewide coverage until the enhanced gate is activated.`
      ),
    }),
    metric({
      key: "nj_current_municipalities",
      label: "Current New Jersey municipalities",
      value: input.njCurrentMunicipalities,
      grain: "current_municipality",
      denominator: "canonical current NJ municipality universe",
      description: "Current New Jersey municipalities. Not contractor counts and not county counts.",
      coverage: "New Jersey",
      contributingSourceSystems: ["nj_dca_construction_metadata"],
      sourceAsOf: input.njMunicipalityAsOf,
      generatedAt,
      publicationStatus: "PUBLIC",
      trace: commonTrace(
        "Canonical current NJ municipality universe.",
        "Not counties, not credentials, not construction-source rows.",
        ["nj_dca_construction_metadata"],
        "New Jersey",
        `Metadata as of ${input.njMunicipalityAsOf}`
      ),
    }),
    metric({
      key: "public_contact_observations",
      label: "Public contact observations",
      value: input.publicContactObservations,
      grain: "public_contact_observation",
      denominator: "public_contact_observations table",
      description: "Public contact fields as published. Not contractor entities and not service territory.",
      coverage: "Research graph",
      contributingSourceSystems: ["public_contact_observations"],
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC_RESEARCH_GRAPH",
      trace: commonTrace(
        "Public contact observation rows.",
        "Not contractor identities, not licenses, not a service-area map.",
        ["public_contact_observations"],
        "Research graph",
        "As published on board extracts."
      ),
    }),
    metric({
      key: "research_graph_contractor_identities",
      label: "Research-graph contractor identity rows",
      value: input.researchGraphContractorIdentities,
      grain: "research_graph_contractor_identity",
      denominator: "contractors table",
      description: "Identity rows in the research graph. Not a U.S. contractor census and not live public coverage.",
      coverage: "Research graph",
      contributingSourceSystems: ["contractors"],
      sourceAsOf: null,
      generatedAt,
      publicationStatus: "PUBLIC_RESEARCH_GRAPH",
      trace: commonTrace(
        "Rows in contractors.",
        "Not live credentials, not entities, not contacts.",
        ["contractors"],
        "Research graph",
        "Identity rows are not a national census."
      ),
    }),
    metric({
      key: "ca_acquired_cslb_license_master_rows_truncated",
      label: "Acquired CSLB License Master rows (truncated stream)",
      value: input.caAcquiredTruncatedRows,
      grain: "acquired_partial_license_master_row",
      denominator: "CA-CON License Master extract with coverage ACQUIRED_PARTIAL_STREAM_TRUNCATED",
      description: "Acquired CSLB public-data portal rows. Stream truncated. Not eligible to replace production ca_cslb live credentials.",
      coverage: "California intelligence snapshot only",
      contributingSourceSystems: ["ca_cslb_master_truncated"],
      sourceAsOf: input.caAcquiredAsOf,
      generatedAt,
      publicationStatus: "PUBLIC_PARTIAL",
      trace: commonTrace(
        "Rows in the truncated CSLB License Master acquisition.",
        "Not the production ca_cslb live credential denominator. Not the complete renewable CSLB universe.",
        ["ca_cslb_master_truncated"],
        "California",
        `Acquisition as_of ${input.caAcquiredAsOf}; coverage ACQUIRED_PARTIAL_STREAM_TRUNCATED`
      ),
    }),
  ];

  const canonical = {
    liveCredentials,
    liveActive: input.liveActiveCurrentCredentialRecords,
    liveStates: input.liveStateCodes,
    liveSources: input.liveSourceSystems,
    licensesBySource: input.licensesBySource,
    graphLicenses: input.researchGraphLicenseRecords,
    contractors: input.researchGraphContractorIdentities,
    actions: input.disciplineActionRows,
    observations: input.regulatoryObservations,
    occurrences: input.regulatoryOccurrences,
    permits: input.indexedPermitSourceRecords,
    contacts: input.publicContactObservations,
    njConstruction: input.njConstructionSourceRecords,
    caTruncated: input.caAcquiredTruncatedRows,
    caProduction: input.caProductionCslbRows,
    countyPages,
  };

  return {
    schemaVersion: CONTRACTOR_NETWORK_METRICS_VERSION,
    generatedAt,
    newestDocumentedSourceAsOf,
    newestDocumentedSourceAsOfNote:
      "Newest documented official source-effective date among metrics that carry a sourceAsOf. Not the live-credential board extract date and not Git/deploy time.",
    sourceFingerprint: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
    liveCohort: {
      liveStates: input.liveStateCodes.length,
      liveStateCodes: input.liveStateCodes,
      liveSourceSystems: input.liveSourceSystems,
      licensesBySource: Object.fromEntries(input.liveSourceSystems.map((s) => [s, input.licensesBySource[s] || 0])),
      cohortRule:
        "licenses.source_system IN live sources parsed from lib/states/config.ts (EVIDENCE_STATES live:true + licenseSource/licenseSources, LIVE_STATE_ORDER)",
      activeCurrentRule: "status_normalized IN ('active','current') within the live source cohort",
    },
    californiaReconciliation: {
      productionCslbCredentialRows: input.caProductionCslbRows,
      acquiredTruncatedLicenseMasterRows: input.caAcquiredTruncatedRows,
      acquiredCoverage: "ACQUIRED_PARTIAL_STREAM_TRUNCATED",
      joinLiveCredentialCohort: false,
      decision:
        "Fail closed. Keep production licenses.ca_cslb as the live California credential contribution. The 75,572 License Master extract is a truncated stream powering /california intelligence and is not merged into the live credential denominator.",
    },
    newJerseyReconciliation: {
      dcaCredentialRows: input.licensesBySource.nj_dca || 0,
      constructionSourceRecords: input.njConstructionSourceRecords,
      constructionGrain: "municipal_permit_or_certificate_source_record",
      constructionMarketOnly: true,
      currentMunicipalities: input.njCurrentMunicipalities,
      publishedCountyPages: input.njPublishedCountyPages,
      publicWorksRegulatorySourceRows: input.njPublicWorksRegulatoryRows,
      vendorCandidatesAreNotLicensedContractors: true,
    },
    metrics,
    evidenceFamilies: input.evidenceFamilies,
    researchGraphExtras: {
      entityLinks: input.contractorEntityLinks,
      regulatoryObservations: input.regulatoryObservations,
      regulatoryOccurrences: input.regulatoryOccurrences,
    },
    licensingStatus: { liveCohort: input.liveStatus },
    tradeFamilies: input.tradeFamilies,
  };
}

export function requiredPublicKeys(): string[] {
  return [
    "live_credential_records",
    "live_active_current_credential_records",
    "live_researched_states",
    "research_graph_license_records",
    "regulatory_discipline_action_rows",
    "indexed_permit_source_records",
    "nj_construction_source_records",
    "published_county_intelligence_pages",
    "nj_current_municipalities",
    "public_contact_observations",
    "research_graph_contractor_identities",
    "ca_acquired_cslb_license_master_rows_truncated",
  ];
}

export type { MetricGrain, PublicationStatus };
