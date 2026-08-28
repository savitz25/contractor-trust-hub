/**
 * Homepage trade families — explicit occupation-code maps only.
 * No description-term or name-keyword matching.
 */
import familiesJson from "./trade-families.json";

export type TradeFamilyMember = {
  sourceSystem: string;
  occupationCodes: string[];
  origin: string;
};

export type HomepageTradeFamily = {
  id: string;
  label: string;
  href: string;
  members: TradeFamilyMember[];
};

export const HOMEPAGE_TRADE_FAMILIES = familiesJson.families as HomepageTradeFamily[];
export const TRADE_NORMALIZATION_EXISTED = familiesJson.canonicalNormalizationExisted;
export const TRADE_NORMALIZATION_NOTE = familiesJson.note;
