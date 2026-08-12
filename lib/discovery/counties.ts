import type { CountyDef } from "./types";

/**
 * Curated Florida counties for discovery (quality over covering every FIPS code).
 * matchNames are matched case-insensitively against board county fields.
 */
export const FLORIDA_COUNTIES: CountyDef[] = [
  { slug: "miami-dade", name: "Miami-Dade", matchNames: ["Miami-Dade", "Miami Dade", "Dade"] },
  { slug: "broward", name: "Broward", matchNames: ["Broward"] },
  { slug: "palm-beach", name: "Palm Beach", matchNames: ["Palm Beach", "PalmBeach"] },
  { slug: "hillsborough", name: "Hillsborough", matchNames: ["Hillsborough"] },
  { slug: "orange", name: "Orange", matchNames: ["Orange"] },
  { slug: "pinellas", name: "Pinellas", matchNames: ["Pinellas"] },
  { slug: "duval", name: "Duval", matchNames: ["Duval"] },
  { slug: "lee", name: "Lee", matchNames: ["Lee"] },
  { slug: "collier", name: "Collier", matchNames: ["Collier"] },
  { slug: "sarasota", name: "Sarasota", matchNames: ["Sarasota"] },
  { slug: "manatee", name: "Manatee", matchNames: ["Manatee"] },
  { slug: "pasco", name: "Pasco", matchNames: ["Pasco"] },
  { slug: "polk", name: "Polk", matchNames: ["Polk"] },
  { slug: "brevard", name: "Brevard", matchNames: ["Brevard"] },
  { slug: "volusia", name: "Volusia", matchNames: ["Volusia"] },
  { slug: "seminole", name: "Seminole", matchNames: ["Seminole"] },
  { slug: "osceola", name: "Osceola", matchNames: ["Osceola"] },
  { slug: "marion", name: "Marion", matchNames: ["Marion"] },
  { slug: "lake", name: "Lake", matchNames: ["Lake"] },
  { slug: "st-lucie", name: "St. Lucie", matchNames: ["St. Lucie", "St Lucie", "Saint Lucie"] },
  { slug: "martin", name: "Martin", matchNames: ["Martin"] },
  { slug: "indian-river", name: "Indian River", matchNames: ["Indian River"] },
  { slug: "charlotte", name: "Charlotte", matchNames: ["Charlotte"] },
  { slug: "escambia", name: "Escambia", matchNames: ["Escambia"] },
  { slug: "leon", name: "Leon", matchNames: ["Leon"] },
  { slug: "alachua", name: "Alachua", matchNames: ["Alachua"] },
  { slug: "bay", name: "Bay", matchNames: ["Bay"] },
  { slug: "okaloosa", name: "Okaloosa", matchNames: ["Okaloosa"] },
  { slug: "st-johns", name: "St. Johns", matchNames: ["St. Johns", "St Johns", "Saint Johns"] },
  { slug: "clay", name: "Clay", matchNames: ["Clay"] },
];
