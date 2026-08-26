import { floridaDiscoveryCounties } from "@/lib/intelligence/florida-county-codes";
import type { CountyDef } from "./types";

/**
 * All 67 Florida counties from official DBPR county codes (11–77).
 * License mailing county is headquarters/base — not evidence of operating here.
 * Source: https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/
 *
 * Major markets stay first (existing URLs unchanged); remaining counties follow.
 */
const PREFERRED_SLUGS = [
  "miami-dade",
  "broward",
  "palm-beach",
  "hillsborough",
  "orange",
  "pinellas",
  "duval",
  "lee",
  "collier",
  "sarasota",
  "manatee",
  "pasco",
  "polk",
  "brevard",
  "volusia",
  "seminole",
  "osceola",
  "marion",
  "lake",
  "st-lucie",
  "martin",
  "indian-river",
  "charlotte",
  "escambia",
  "leon",
  "alachua",
  "bay",
  "okaloosa",
  "st-johns",
  "clay",
];

const all = floridaDiscoveryCounties();
const bySlug = new Map(all.map((c) => [c.slug, c]));
export const FLORIDA_COUNTIES: CountyDef[] = [
  ...PREFERRED_SLUGS.map((s) => bySlug.get(s)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
  ...all.filter((c) => !PREFERRED_SLUGS.includes(c.slug)),
];

export const FLORIDA_GEO_NOTE =
  "County pages list credentials whose DBPR mailing/principal county code is this county. That is headquarters/base, not proof the firm operates or pulls permits here. Statewide totals are not the sum of county operating totals.";
