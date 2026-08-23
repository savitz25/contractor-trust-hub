/**
 * ASK-SEARCH-CONTRACTOR-002 — approved Ask → Contractor structured handoff keys.
 * No raw query. No PII. No arbitrary JSON.
 */

import type { AskContractorCategory } from "@/lib/network-discovery/trades";
import { FLORIDA_READY_CATEGORIES } from "@/lib/network-discovery/florida-policy";

export const ASK_HANDOFF_KEYS = [
  "src",
  "journey",
  "state",
  "county",
  "intent",
  "entity",
  "category",
  "city",
  "zip",
  "sid",
] as const;

export const ASK_HANDOFF_FORBIDDEN_KEYS = [
  "q",
  "query",
  "email",
  "phone",
  "name",
  "street_address",
  "address",
  "account",
  "ssn",
  "income",
  "document",
  "contract",
  "payment",
  "next",
  "redirect",
  "returnurl",
  "return_url",
] as const;

export const CONTRACTOR_HANDOFF_ENTITY = "contractor" as const;

/** Category aliases that still mean the canonical contractor company. */
export const CONTRACTOR_ENTITY_ALIASES = [
  "contractor",
  "contractors",
  "roofer",
  "plumber",
  "hvac_contractor",
  "pool_contractor",
  "general_contractor",
] as const;

export const UNSUPPORTED_HANDOFF_ENTITIES = [
  "home_inspector",
  "electrician",
  "solar_contractor",
  "painter",
] as const;

export const FLORIDA_HANDOFF_CATEGORIES = FLORIDA_READY_CATEGORIES;

export type ContractorAskCategory = (typeof FLORIDA_READY_CATEGORIES)[number];

export const UNSUPPORTED_HANDOFF_CATEGORIES = [
  "electrical",
  "electrician",
  "solar",
  "solar_contractor",
  "painting",
  "painter",
  "flooring",
  "kitchen_remodeling",
  "bathroom_remodeling",
  "home_inspector",
  "home_inspectors",
] as const;

export type ContractorAskSearchContext = {
  source: "ask";
  entityType?: typeof CONTRACTOR_HANDOFF_ENTITY;
  unsupportedEntity?: string;
  category?: ContractorAskCategory;
  unsupportedCategory?: string;
  state?: string;
  county?: string;
  city?: string;
  zip?: string;
  intent?: string;
  journey?: string;
  sid?: string;
};

export type { AskContractorCategory };
