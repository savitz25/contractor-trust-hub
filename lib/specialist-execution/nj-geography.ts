export const NJ_COUNTIES = [
  "Atlantic", "Bergen", "Burlington", "Camden", "Cape May", "Cumberland", "Essex",
  "Gloucester", "Hudson", "Hunterdon", "Mercer", "Middlesex", "Monmouth", "Morris",
  "Ocean", "Passaic", "Salem", "Somerset", "Sussex", "Union", "Warren",
] as const;

export type NjCounty = (typeof NJ_COUNTIES)[number];

type Municipality = {
  city: string;
  county: NjCounty;
  municipalityCode: string;
  source: string;
};

/**
 * Bounded authoritative city mappings used by V2. Add cities only with an
 * official NJ municipality/county source, never from ad-hoc address frequency.
 */
const NJ_MUNICIPALITIES: Record<string, Municipality> = {
  summit: {
    city: "Summit",
    county: "Union",
    municipalityCode: "2018",
    source: "https://www.nj.gov/treasury/omb/pdf/forms/municodes.pdf",
  },
};

function normalizedPlace(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveNjCounty(raw: string): NjCounty | null {
  const normalized = normalizedPlace(raw).replace(/ county$/, "");
  return NJ_COUNTIES.find((county) => county.toLowerCase() === normalized) ?? null;
}

export function resolveNjMunicipality(raw: string): Municipality | null {
  return NJ_MUNICIPALITIES[normalizedPlace(raw)] ?? null;
}

export function isSummitCountyRequest(raw: string): boolean {
  return normalizedPlace(raw).replace(/ county$/, "") === "summit";
}

export function publicNjMunicipalityMappings() {
  return Object.values(NJ_MUNICIPALITIES);
}
