/**
 * ContractorTrustHub intelligence vocabulary.
 * These types are the counting/attribution contract. They are not interchangeable.
 */

export type IntelligenceEntityKind =
  | "raw_source_record"
  | "parsed_observation"
  | "matched_observation"
  | "attributed_evidence"
  | "credential"
  | "person"
  | "qualifier"
  | "business"
  | "business_entity"
  | "relationship"
  | "finding"
  | "disposition";

export type AttributionClass =
  | "CONFIRMED"
  | "HIGH_CONFIDENCE"
  | "REVIEW_REQUIRED"
  | "UNRESOLVED";

export type PublicationState = "PUBLIC" | "INTERNAL" | "WITHHELD";

export type EvidenceLayer =
  | "raw_source_record"
  | "parsed_observation"
  | "matched_observation"
  | "attributed_evidence";

export type MetricPublicEligibility = "public" | "internal_only" | "not_yet_calculable";

export type SourceFamily =
  | "fl_dbpr_licensing"
  | "fl_dbpr_discipline"
  | "fl_dbpr_unlicensed_activity"
  | "fl_dbpr_recovery_fund"
  | "fl_dfs_stop_work"
  | "fl_sunbiz"
  | "fl_qualifier_relationships";

export type MetricDefinition = {
  id: string;
  label: string;
  /** What is being counted — never implied. */
  entityCounted: IntelligenceEntityKind | string;
  deduplicationKey: string;
  filters: string[];
  dateRules: string;
  statusRules: string;
  attributionThreshold: AttributionClass | "n/a";
  publicEligibility: MetricPublicEligibility;
  notes: string;
};

export type SourceAttributionRule = {
  sourceFamily: SourceFamily;
  confirmed: string;
  highConfidence: string;
  reviewRequired: string;
  unresolved: string;
  publicEligible: AttributionClass[];
  inheritAcrossSharedQualifier: false;
};
