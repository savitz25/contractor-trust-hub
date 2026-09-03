/** Client/server filter over compact acquired CSLB public-data rows. */

export type CaInventoryRow = [
  license: string,
  name: string,
  city: string,
  zip: string,
  county: string,
  status: string,
  classes: string,
  phone: string,
  asbestosExact: string,
];

export type CaInventoryFile = {
  version: string;
  coverage: string;
  label: string;
  as_of: string;
  count: number;
  fields: string[];
  phone_eligibility: string;
  address_eligibility: string;
  rows: CaInventoryRow[];
};

export type CaSearchQuery = {
  q?: string;
  status?: string;
  classification?: string;
  city?: string;
  zip?: string;
};

export const CA_SEARCH_LIMIT = 50;

function norm(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function filterCaInventory(
  rows: CaInventoryRow[],
  query: CaSearchQuery,
  limit = CA_SEARCH_LIMIT,
): CaInventoryRow[] {
  const q = norm(query.q);
  const status = norm(query.status);
  const cls = (query.classification || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const city = norm(query.city);
  const zip = (query.zip || "").replace(/\D/g, "").slice(0, 5);
  const digits = q.replace(/\D/g, "");
  const licenseQuery = digits.length >= 5 && digits === q.replace(/\s/g, "");

  const out: CaInventoryRow[] = [];
  for (const row of rows) {
    if (status && row[5].toLowerCase() !== status) continue;
    if (cls) {
      const tokens = row[6].split(",").map((t) => t.replace(/[^A-Z0-9]/g, "").toUpperCase());
      if (!tokens.includes(cls)) continue;
    }
    if (city && !row[2].toLowerCase().includes(city)) continue;
    if (zip && !row[3].startsWith(zip)) continue;
    if (q) {
      if (licenseQuery) {
        if (row[0] !== digits) continue;
      } else if (
        !row[0].includes(digits) &&
        !row[1].toLowerCase().includes(q) &&
        !row[2].toLowerCase().includes(q) &&
        !row[3].includes(q) &&
        !row[4].toLowerCase().includes(q) &&
        !row[5].toLowerCase().includes(q) &&
        !row[6].toLowerCase().includes(q.replace(/[^a-z0-9]/g, ""))
      ) {
        continue;
      }
    }
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function cslbLiveStatusUrl(license: string, prefix: string): string {
  return `${prefix}${encodeURIComponent(license)}`;
}
