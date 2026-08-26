/**
 * Metric readiness for State Intelligence UI.
 * Consumer pages render READY only. INTERNAL_ONLY / NOT_READY are omitted
 * or explained as coverage — never shown as zero.
 */

export type MetricReadiness = "READY" | "INTERNAL_ONLY" | "NOT_READY";

/** Statewide claims that must not appear as consumer Intelligence numbers. */
export const EXCLUDED_STATEWIDE_METRIC_IDS = [
  "distinct_legal_businesses",
  "distinct_contractor_companies",
  "active_contractor_businesses",
  "dbpr_cbi_census",
  "statewide_qualifier_count",
  "statewide_primary_qa_count",
  "statewide_secondary_qa_count",
  "businesses_with_multiple_qualifiers",
  "qualifiers_with_multiple_businesses",
  "distinct_people",
  "statewide_confirmed_sunbiz_entities",
  "contractors_affected_by_discipline",
  "businesses_affected_by_recovery_fund",
  "businesses_affected_by_dfs_stop_work",
  "businesses_affected_by_ula",
  "operating_county",
  "permit_activity",
  "pilot_qualifier_edges",
  "pilot_cbi_resolution_rate",
] as const;

export type ExcludedStatewideMetricId = (typeof EXCLUDED_STATEWIDE_METRIC_IDS)[number];

export function isExcludedStatewideMetric(id: string): boolean {
  return (EXCLUDED_STATEWIDE_METRIC_IDS as readonly string[]).includes(id);
}

/** Consumer UI renders a numeric metric only when READY and public. */
export function shouldRenderConsumerMetric(opts: {
  readiness: MetricReadiness;
  publicEligibility: "public" | "internal_only" | "not_yet_calculable";
}): boolean {
  return opts.readiness === "READY" && opts.publicEligibility === "public";
}
