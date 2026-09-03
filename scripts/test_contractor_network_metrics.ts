import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeContractorNetworkMetrics,
  type NetworkMetricsInput,
} from "../lib/metrics/compute-contractor-network-metrics";
import { metricByKey } from "../lib/metrics/contractor-network-metrics-v1";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function baseInput(over: Partial<NetworkMetricsInput> = {}): NetworkMetricsInput {
  const liveSourceSystems = [
    "az_roc",
    "ca_cslb",
    "fl_dbpr",
    "ky_dhbc",
    "la_lslbc",
    "ms_sbc",
    "nj_dca",
    "or_ccb",
    "tx_tdlr",
    "tx_tsbpe",
    "wa_lni",
  ];
  const licensesBySource: Record<string, number> = {
    az_roc: 58408,
    ca_cslb: 43779,
    fl_dbpr: 143516,
    ky_dhbc: 8360,
    la_lslbc: 26298,
    ms_sbc: 8242,
    nj_dca: 87355,
    or_ccb: 55980,
    tx_tdlr: 37834,
    tx_tsbpe: 13651,
    wa_lni: 160998,
    ct_dcp: 134863,
  };
  return {
    generatedAt: "2026-09-03T18:00:00.000Z",
    liveStateCodes: ["FL", "TX", "NJ", "OR", "WA", "CA", "AZ", "LA", "MS", "KY"],
    liveSourceSystems,
    licensesBySource,
    liveActiveCurrentCredentialRecords: 499997,
    researchGraphLicenseRecords: 1266214,
    researchGraphContractorIdentities: 1392730,
    contractorEntityLinks: 281255,
    publicContactObservations: 16009,
    disciplineActionRows: 69674,
    regulatoryObservations: 68081,
    regulatoryOccurrences: 68087,
    indexedPermitSourceRecords: 139586,
    evidenceFamilies: [
      {
        key: "fl_dfs_stop_work",
        label: "Florida DFS workers' compensation stop-work records",
        sourceSystem: "fl_dfs",
        sourceDataset: "fl_dfs_workers_comp_stop_work",
        rows: 48254,
        grain: "discipline_action_row",
      },
      {
        key: "other",
        label: "other",
        sourceSystem: "fl_dbpr",
        sourceDataset: "x",
        rows: 21420,
        grain: "discipline_action_row",
      },
    ],
    liveStatus: {
      active: 463418,
      current: 36579,
      inactive: 58880,
      expired: 65877,
      suspended: 9822,
      revoked: 14,
      unlicensed: 257,
      other: 9574,
    },
    tradeFamilies: { canonicalNormalizationExisted: false, note: "test", families: [] },
    caProductionCslbRows: 43779,
    caAcquiredTruncatedRows: 75572,
    caAcquiredAsOf: "2026-09-02",
    njConstructionSourceRecords: 2678341,
    njConstructionSourceAsOf: "2026-08-07",
    njCurrentMunicipalities: 564,
    njMunicipalityAsOf: "2026-08-13",
    njPublishedCountyPages: 4,
    njPublicWorksRegulatoryRows: 1898,
    floridaCountyIntelligencePages: 4,
    caCityLocalPages: 2,
    ...over,
  };
}

describe("contractor-network-metrics-v1 grain safety", () => {
  it("computes live credentials as the sum of live sources only", () => {
    const m = computeContractorNetworkMetrics(baseInput());
    assert.equal(metricByKey(m, "live_credential_records").value, 644421);
    assert.equal(metricByKey(m, "live_active_current_credential_records").value, 499997);
    assert.equal(metricByKey(m, "live_researched_states").value, 10);
    assert.ok(metricByKey(m, "live_credential_records").value !== metricByKey(m, "research_graph_license_records").value);
  });

  it("rejects a live source omitted from the credential denominator", () => {
    const input = baseInput();
    delete input.licensesBySource.nj_dca;
    assert.throws(() => computeContractorNetworkMetrics(input), /omitted/);
  });

  it("rejects truncated CSLB extract as the production ca_cslb denominator", () => {
    assert.throws(
      () => computeContractorNetworkMetrics(baseInput({ caAcquiredTruncatedRows: 43779 })),
      /truncated CSLB/
    );
  });

  it("keeps NJ construction source records out of live credentials and indexed permits", () => {
    const m = computeContractorNetworkMetrics(baseInput());
    const cred = metricByKey(m, "live_credential_records").value;
    const permits = metricByKey(m, "indexed_permit_source_records").value;
    const nj = metricByKey(m, "nj_construction_source_records").value;
    assert.equal(nj, 2678341);
    assert.notEqual(nj, cred);
    assert.notEqual(nj, permits);
    assert.equal(metricByKey(m, "nj_construction_source_records").grain, "municipal_permit_or_certificate_source_record");
    assert.equal(m.newJerseyReconciliation.constructionMarketOnly, true);
    assert.equal(m.newJerseyReconciliation.vendorCandidatesAreNotLicensedContractors, true);
  });

  it("keeps contacts out of contractor identity counts", () => {
    const m = computeContractorNetworkMetrics(baseInput());
    assert.notEqual(
      metricByKey(m, "public_contact_observations").value,
      metricByKey(m, "research_graph_contractor_identities").value
    );
  });

  it("keeps county pages out of live state counts", () => {
    const m = computeContractorNetworkMetrics(baseInput());
    assert.equal(metricByKey(m, "published_county_intelligence_pages").value, 8);
    assert.equal(metricByKey(m, "published_ca_city_local_intelligence_pages").value, 2);
    assert.notEqual(metricByKey(m, "published_county_intelligence_pages").value, metricByKey(m, "live_researched_states").value);
    assert.notEqual(metricByKey(m, "published_ca_city_local_intelligence_pages").value, metricByKey(m, "published_county_intelligence_pages").value);
    assert.throws(() => computeContractorNetworkMetrics(baseInput({ floridaCountyIntelligencePages: 6 })), /county pages/);
  });

  it("does not treat Git/deploy time as NJ official source date", () => {
    const m = computeContractorNetworkMetrics(baseInput({ generatedAt: "2026-09-03T18:00:00.000Z" }));
    assert.equal(metricByKey(m, "nj_construction_source_records").sourceAsOf, "2026-08-07");
    assert.notEqual(metricByKey(m, "nj_construction_source_records").sourceAsOf, m.generatedAt.slice(0, 10));
    assert.equal(metricByKey(m, "live_credential_records").sourceAsOf, null);
    assert.equal(m.newestDocumentedSourceAsOf, "2026-09-02");
  });

  it("fails closed on California live-cohort join", () => {
    const m = computeContractorNetworkMetrics(baseInput());
    assert.equal(m.californiaReconciliation.joinLiveCredentialCohort, false);
    assert.equal(m.californiaReconciliation.productionCslbCredentialRows, 43779);
    assert.equal(m.californiaReconciliation.acquiredTruncatedLicenseMasterRows, 75572);
    assert.equal(metricByKey(m, "ca_acquired_cslb_license_master_rows_truncated").publicationStatus, "PUBLIC_PARTIAL");
  });

  it("does not sum observations into discipline actions", () => {
    assert.throws(
      () =>
        computeContractorNetworkMetrics(
          baseInput({
            disciplineActionRows: 68081 + 68087,
            evidenceFamilies: [
              {
                key: "x",
                label: "x",
                sourceSystem: "x",
                sourceDataset: "",
                rows: 68081 + 68087,
                grain: "discipline_action_row",
              },
            ],
          })
        ),
      /observations/
    );
  });
});

describe("checked-in manifest vs homepage wiring", () => {
  it("keeps homepage consumers on the v1 artifact path", () => {
    const hero = readFileSync(join(root, "components/home/HomeIntelHero.tsx"), "utf8");
    const load = readFileSync(join(root, "lib/home/load-intel-v2.ts"), "utf8");
    assert.match(hero, /loadContractorNetworkMetrics|contractor-network-metrics-v1|newestDocumentedSourceAsOf/);
    assert.match(load, /contractor-network-metrics-v1|projectIntelV2FromNetworkMetrics/);
  });
});
