import type { CountyDef } from "./types";

/**
 * Curated Florida counties for discovery (quality over covering every FIPS code).
 * matchNames — board county_name / primary_county (case-insensitive).
 * matchCodes — licenses.county_code values observed when county_name is present
 *              (DBPR extract codes, not US FIPS).
 */
export const FLORIDA_COUNTIES: CountyDef[] = [
  {
    slug: "miami-dade",
    name: "Miami-Dade",
    matchNames: ["Miami-Dade", "Miami Dade", "Dade"],
    matchCodes: ["23"],
  },
  { slug: "broward", name: "Broward", matchNames: ["Broward"], matchCodes: ["16"] },
  {
    slug: "palm-beach",
    name: "Palm Beach",
    matchNames: ["Palm Beach", "PalmBeach"],
    matchCodes: ["60"],
  },
  {
    slug: "hillsborough",
    name: "Hillsborough",
    matchNames: ["Hillsborough"],
    matchCodes: ["39"],
  },
  { slug: "orange", name: "Orange", matchNames: ["Orange"], matchCodes: ["58"] },
  { slug: "pinellas", name: "Pinellas", matchNames: ["Pinellas"], matchCodes: ["62"] },
  { slug: "duval", name: "Duval", matchNames: ["Duval"], matchCodes: ["26"] },
  { slug: "lee", name: "Lee", matchNames: ["Lee"], matchCodes: ["46"] },
  { slug: "collier", name: "Collier", matchNames: ["Collier"], matchCodes: ["21"] },
  { slug: "sarasota", name: "Sarasota", matchNames: ["Sarasota"], matchCodes: ["68"] },
  { slug: "manatee", name: "Manatee", matchNames: ["Manatee"], matchCodes: ["51"] },
  { slug: "pasco", name: "Pasco", matchNames: ["Pasco"], matchCodes: ["61"] },
  { slug: "polk", name: "Polk", matchNames: ["Polk"] },
  { slug: "brevard", name: "Brevard", matchNames: ["Brevard"] },
  { slug: "volusia", name: "Volusia", matchNames: ["Volusia"] },
  { slug: "seminole", name: "Seminole", matchNames: ["Seminole"] },
  { slug: "osceola", name: "Osceola", matchNames: ["Osceola"] },
  { slug: "marion", name: "Marion", matchNames: ["Marion"], matchCodes: ["52"] },
  { slug: "lake", name: "Lake", matchNames: ["Lake"] },
  {
    slug: "st-lucie",
    name: "St. Lucie",
    matchNames: ["St. Lucie", "St Lucie", "Saint Lucie"],
  },
  { slug: "martin", name: "Martin", matchNames: ["Martin"] },
  { slug: "indian-river", name: "Indian River", matchNames: ["Indian River"] },
  { slug: "charlotte", name: "Charlotte", matchNames: ["Charlotte"] },
  { slug: "escambia", name: "Escambia", matchNames: ["Escambia"] },
  { slug: "leon", name: "Leon", matchNames: ["Leon"] },
  { slug: "alachua", name: "Alachua", matchNames: ["Alachua"] },
  { slug: "bay", name: "Bay", matchNames: ["Bay"] },
  { slug: "okaloosa", name: "Okaloosa", matchNames: ["Okaloosa"] },
  {
    slug: "st-johns",
    name: "St. Johns",
    matchNames: ["St. Johns", "St Johns", "Saint Johns"],
  },
  { slug: "clay", name: "Clay", matchNames: ["Clay"] },
];
