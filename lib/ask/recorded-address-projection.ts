/**
 * CTH-CARD-001 public recorded-address projection for the current /ask page.
 *
 * Policy:
 * - contractor-name-candidates-v1 and its privacy guard stay unchanged. That
 *   response still excludes street and postal fields.
 * - This module is not that operation. It loads the address the public Trust
 *   Report already shows for one license: licenses.address_line_1, city, state,
 *   postal_code, and county_name.
 * - Rows are paired by the card's stored profile slug and the card's credential
 *   key. A name is never the join.
 * - Thin profiles are excluded here. A public profile page can still show a
 *   limited thin profile, so this gate is not the same as that page.
 * - One statement covers the whole page. A failed statement is "could not be
 *   loaded," not "the source has no address."
 * - Phone, email, claim, account, and raw license payloads are not selected.
 */
import type { AskEntityCard } from "@/lib/ask/execute";
import { query as defaultQuery } from "@/lib/db";
import { fallbackProfileAddress, formatLicenseAddress, type PublicAddressView } from "@/lib/ask/recorded-address-display";

export type AddressProjectionCard = AskEntityCard & { publicAddress?: PublicAddressView };

type AddressRow = {
  slug: string;
  license_number: string | null;
  external_key: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  county_name: string | null;
  is_thin_profile: boolean;
};

type AddressDb = {
  query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
};

const ADDRESS_SQL = `
SELECT c.slug,
       c.is_thin_profile,
       l.license_number,
       l.external_key,
       l.address_line_1,
       l.city,
       l.state,
       l.postal_code,
       l.county_name
FROM contractors c
JOIN licenses l ON l.contractor_id = c.id
WHERE c.is_thin_profile = FALSE
  AND c.slug = ANY($1::text[])
  AND (l.license_number = ANY($2::text[]) OR l.external_key = ANY($2::text[]))
`;

function pairKey(slug: string, credentialKey: string): string {
  return `${slug}\u0000${credentialKey}`;
}

function rowMatches(slug: string, credentialKey: string, row: AddressRow): boolean {
  if (row.is_thin_profile || row.slug !== slug) return false;
  return row.license_number === credentialKey || row.external_key === credentialKey;
}

const defaultDb: AddressDb = {
  query: async <T>(text: string, params?: unknown[]) => (await defaultQuery(text, params)) as T[],
};

export async function attachRecordedAddresses(
  cards: AskEntityCard[],
  db: AddressDb = defaultDb,
): Promise<{ results: AddressProjectionCard[]; queries: number; timingMs: number; status: "ok" | "unavailable" }> {
  const wanted = cards.filter((card) => card.slug && card.credentialKey);
  if (wanted.length === 0) {
    return { results: cards.map((card) => ({ ...card })), queries: 0, timingMs: 0, status: "ok" };
  }
  const slugs = [...new Set(wanted.map((card) => card.slug))];
  const keys = [...new Set(wanted.map((card) => card.credentialKey).filter((key): key is string => Boolean(key)))];
  const started = Date.now();
  let rows: AddressRow[];
  try {
    rows = await db.query<AddressRow>(ADDRESS_SQL, [slugs, keys]);
  } catch {
    const timingMs = Date.now() - started;
    return {
      queries: 1,
      timingMs,
      status: "unavailable",
      results: cards.map((card) => ({ ...card, publicAddress: { ...fallbackProfileAddress(card), status: "unavailable" as const } })),
    };
  }
  const timingMs = Date.now() - started;
  const grouped = new Map<string, AddressRow[]>();
  for (const card of wanted) {
    const key = pairKey(card.slug, card.credentialKey || "");
    const matches = rows.filter((row) => rowMatches(card.slug, card.credentialKey || "", row));
    grouped.set(key, matches);
  }
  const results: AddressProjectionCard[] = cards.map((card): AddressProjectionCard => {
    if (!card.slug || !card.credentialKey) return { ...card, publicAddress: fallbackProfileAddress(card) };
    const matches = grouped.get(pairKey(card.slug, card.credentialKey)) ?? [];
    if (matches.length !== 1) return { ...card, publicAddress: fallbackProfileAddress(card) };
    const row = matches[0];
    const formatted = formatLicenseAddress({
      street: row.address_line_1,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      county: row.county_name,
    });
    return { ...card, publicAddress: { status: "loaded", ...formatted } };
  });
  return { results, queries: 1, timingMs, status: "ok" };
}

export { ADDRESS_SQL };
