/**
 * INTEL-003 — Aggregation & geographic counting standard.
 *
 * "104,444 active licenses" counts credentials with secondary_status=A.
 * It is not "X active contractor businesses."
 */

import { INTELLIGENCE_TRADE_BUCKETS, isContractorTradeOccupation } from "./occupations";
import { classifyFloridaCountyCode } from "./florida-county-codes";
import { PUBLIC_SUNBIZ_MIN_CONFIDENCE } from "./attribution";

export const STATEWIDE_VS_COUNTY_RULE =
  "Florida statewide credential totals do not have to equal the sum of county operating totals. A contractor may operate in multiple counties. Headquarters/base county is the license mailing county. Operating county is attributed permit/activity evidence. Do not sum operating-county counts to produce a statewide total.";

export const ACTIVE_LICENSE_SQL = `
  source_system = 'fl_dbpr'
  AND status_normalized = 'active'
`;

export const ACTIVE_OR_CURRENT_IS_NOT_ACTIVE =
  "status_normalized='current' means primary C with blank secondary (FRO, CRS1, PVDR). It is not an active trade license.";

export type AggregationRule = {
  id: string;
  entityCounted: string;
  how: string;
  public: boolean;
};

export const AGGREGATION_RULES: AggregationRule[] = [
  {
    id: "statewide_credentials",
    entityCounted: "credential rows (licenses.source_system=fl_dbpr)",
    how: "COUNT(*) on licenses. Includes FRO/CRS1/PVDR. Excludes QB (not in licenses).",
    public: true,
  },
  {
    id: "statewide_active_credentials",
    entityCounted: "credentials with status_normalized=active",
    how: "Secondary status A only. Do not add 'current'.",
    public: true,
  },
  {
    id: "statewide_active_trade_credentials",
    entityCounted: "active credentials whose occupation is a certified/registered trade",
    how: "active_license AND isContractorTradeOccupation(occupation_code). Excludes FRO/QB/CRS1/PVDR.",
    public: true,
  },
  {
    id: "distinct_persons",
    entityCounted: "resolved persons",
    how: "Not calculable. Do not publish distinct(licensee_name_raw).",
    public: false,
  },
  {
    id: "distinct_qualifiers",
    entityCounted: "qualifiers",
    how: "Requires PERSON→LICENSE→QUALIFIES→BUSINESS. Role=qualifier is 0.",
    public: false,
  },
  {
    id: "distinct_businesses",
    entityCounted: "resolved businesses",
    how: "Sunbiz document numbers at confidence>=0.95 unique match, or QB entity keys as business shells (separate metric).",
    public: false,
  },
  {
    id: "businesses_with_multiple_licenses",
    entityCounted: "resolved businesses with >1 credential",
    how: "Group credentials by Sunbiz document number (HIGH_CONFIDENCE+). DBA-name grouping is heuristic only.",
    public: false,
  },
  {
    id: "persons_with_multiple_licenses",
    entityCounted: "resolved persons with >1 credential",
    how: "Not calculable until person resolution exists.",
    public: false,
  },
  {
    id: "multiple_qualifiers_per_business",
    entityCounted: "qualifying relationships",
    how: "Not calculable. Graph missing.",
    public: false,
  },
  {
    id: "multiple_businesses_per_qualifier",
    entityCounted: "qualifying relationships",
    how: "Not calculable. Graph missing. Must not copy discipline across businesses that share a qualifier.",
    public: false,
  },
  {
    id: "headquarters_base_county",
    entityCounted: "credentials (or businesses when resolved) whose license mailing county_code is 11–77",
    how: "classifyFloridaCountyCode(county_code).kind === florida_county. Out-of-state 701–799 excluded from county HQ totals.",
    public: true,
  },
  {
    id: "operating_county",
    entityCounted: "credentials with attributed operating evidence in that county",
    how: "Permit/activity joins on exact license key only. Currently no permit_records.",
    public: false,
  },
  {
    id: "businesses_associated_with_multiple_counties",
    entityCounted: "resolved businesses",
    how: "Distinct HQ county vs distinct operating counties. Expected and not an error.",
    public: false,
  },
  {
    id: "multi_state_licensing",
    entityCounted: "credentials with licenses.state <> 'FL' or county_code in 701–799",
    how: "Florida-issued credential with out-of-state mailing is still a Florida credential. It is not an operating-county presence.",
    public: true,
  },
  {
    id: "historical_entities",
    entityCounted: "entities / observations",
    how: "Retain. Never delete because a later name or status changed.",
    public: false,
  },
  {
    id: "historical_relationships",
    entityCounted: "relationships",
    how: "Requires start/end. Not stored. Do not treat linked_at as the qualifying window.",
    public: false,
  },
  {
    id: "duplicate_license_source_records",
    entityCounted: "raw records skipped as duplicate external_key",
    how: "Adapter skipped_duplicate_key. 378 in the 2026-08-10 extract.",
    public: false,
  },
  {
    id: "merged_business_entities",
    entityCounted: "business_entity",
    how: "Not modeled. Do not merge Sunbiz document numbers.",
    public: false,
  },
  {
    id: "renamed_entities",
    entityCounted: "business_entity",
    how: "Sunbiz historical names not represented in the current entities row beyond current legal_name.",
    public: false,
  },
  {
    id: "successor_predecessor",
    entityCounted: "relationship",
    how: "Not modeled. Officer-name related entities are context, not succession.",
    public: false,
  },
];

export function countyMetricKind(countyCode: string | null | undefined): "hq" | "excluded" | "unknown" {
  const cls = classifyFloridaCountyCode(countyCode);
  if (!cls) return "unknown";
  if (cls.kind === "florida_county") return "hq";
  return "excluded";
}

export { INTELLIGENCE_TRADE_BUCKETS, isContractorTradeOccupation, PUBLIC_SUNBIZ_MIN_CONFIDENCE };
