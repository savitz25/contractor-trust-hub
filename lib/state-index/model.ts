import records from "./records.data.json";

export type StateEntityRow = {
  name: string;
  city: string | null;
  credentialType: string | null;
  status: string | null;
  date: string | null;
  href: string | null;
};

export type StateIndexSource = {
  slug: string;
  stateName: string;
  label: string;
  sourceName: string;
  retrieved: string;
  officialLabel: string;
  total: number;
  cityCount: number;
  topCity: string | null;
  topCityCount: number;
  topCredential: string | null;
  credentialCount: number;
  topStatus: string | null;
  statusCount: number;
  dateMin: string | null;
  dateMax: string | null;
  rows: StateEntityRow[];
};

export type StateIndexModel = {
  slug: string;
  stateName: string;
  facts: string[];
  rows: StateEntityRow[];
  about: string;
};

const sources = records as Record<string, StateIndexSource>;

export function stateIndexSource(slug: string): StateIndexSource | null {
  return sources[slug] ?? null;
}

export function buildStateFacts(source: StateIndexSource): string[] {
  const facts = [
    `${source.stateName} counts ${source.total.toLocaleString("en-US")} ${source.label} in the source already used on this page.`,
  ];
  if (source.topCity && source.cityCount > 0) {
    facts.push(
      `Those records name ${source.cityCount.toLocaleString("en-US")} cities. ${source.topCity} accounts for ${source.topCityCount.toLocaleString("en-US")} of them.`,
    );
  }
  if (source.topCredential && source.credentialCount > 1) {
    facts.push(
      `Credential types in that source number ${source.credentialCount.toLocaleString("en-US")}, and ${source.topCredential} is the largest group.`,
    );
  } else if (source.topCredential) {
    facts.push(`Each listed record uses the credential type ${source.topCredential}.`);
  }
  if (facts.length < 4 && source.dateMin && source.dateMax) {
    facts.push(`Printed dates in that source run from ${source.dateMin} through ${source.dateMax}.`);
  } else if (facts.length < 4 && source.topStatus) {
    facts.push(`The most common printed status is ${source.topStatus}.`);
  }
  return facts.slice(0, 4);
}

export function buildStateAbout(source: StateIndexSource): string {
  return `${source.stateName} ${source.label} are read from ${source.sourceName}, retrieved ${source.retrieved}. The table shows the name, city, credential type, status, and date that source prints. Confirm a record with ${source.officialLabel}.`;
}

export function getStateIndex(slug: string): StateIndexModel | null {
  const source = stateIndexSource(slug);
  if (!source || source.rows.length < 25) return null;
  const facts = buildStateFacts(source);
  if (facts.length < 2 || facts.length > 4) return null;
  return {
    slug: source.slug,
    stateName: source.stateName,
    facts,
    rows: source.rows,
    about: buildStateAbout(source),
  };
}
