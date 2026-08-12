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
};

export type CountyDef = {
  /** URL slug, e.g. miami-dade */
  slug: string;
  /** Display name, e.g. Miami-Dade */
  name: string;
  /**
   * Values matched against licenses.county_name / contractors.primary_county
   * (case-insensitive exact or prefix).
   */
  matchNames: string[];
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
