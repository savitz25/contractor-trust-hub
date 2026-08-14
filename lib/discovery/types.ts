/** State-agnostic discovery layer types. Florida is the first adapter. */

export type TradeDef = {
  /** URL slug, e.g. roofers */
  slug: string;
  /** Short nav label */
  label: string;
  /** Page H1 / title fragment */
  title: string;
  /** Meta description fragment */
  description: string;
  /** DBPR occupation codes included in this consumer category */
  occupationCodes: string[];
  /**
   * Optional published class / specialty codes (Washington L&I specialtycode1).
   * Combined with descriptionIncludes using OR when either is set.
   */
  classCodes?: string[];
  /**
   * Optional case-insensitive substrings matched against occupation_description.
   * Used when a type code is broad (WA construction contractor) and the specialty
   * lives in the published description.
   */
  descriptionIncludes?: string[];
};

export type CountyDef = {
  /** URL slug, e.g. miami-dade */
  slug: string;
  /** Display name, e.g. Miami-Dade */
  name: string;
  /**
   * Values matched against licenses.county_name / contractors.primary_county
   * (case-insensitive).
   */
  matchNames: string[];
  /**
   * Optional DBPR licenses.county_code values (extract codes when name is missing).
   */
  matchCodes?: string[];
  /**
   * Cities matched against licenses.city / contractors.primary_city when the
   * extract has no county (Arizona ROC). Compared case-insensitively.
   */
  matchCities?: string[];
  /** County vs dedicated city page. Default county. */
  kind?: "county" | "city";
  /**
   * 5-digit ZIP codes used to derive county when the extract has no official
   * county field (Washington L&I). Query-time only — not written onto rows.
   */
  matchPostalPrefixes?: string[];
  /**
   * Match mailing state other than the license state (out-of-state mailing).
   */
  matchOutOfStateMailing?: boolean;
  /**
   * Optional AND filter on licenses.state (e.g. WA city pages exclude
   * Vancouver, B.C. mailing rows that share the city name).
   */
  matchStates?: string[];
};

export type DiscoveryStateConfig = {
  /** Public URL segment: "florida" (supports future "new-jersey") */
  publicSlug: string;
  /** Evidence config key: "fl" */
  evidenceSlug: string;
  name: string;
  shortName: string;
  /** Landing page intro */
  blurb: string;
  counties: CountyDef[];
  trades: TradeDef[];
  live: boolean;
  /** Optional major-city browse (Arizona). */
  cities?: CountyDef[];
  /** Honest geo-method note for product UI. */
  geoNote?: string;
  /** Default browse to active credentials only (Arizona current list). */
  activeOnlyDefault?: boolean;
  /**
   * When false, browse includes every row for the license source (Oregon
   * out-of-state CCB mailing addresses). Default true.
   */
  requireInStateAddress?: boolean;
};

export type DiscoveryFacet = {
  slug: string;
  label: string;
  count: number;
};

export type DiscoveryListOptions = {
  publicStateSlug: string;
  countySlug?: string;
  tradeSlug?: string;
  limit?: number;
  offset?: number;
};
