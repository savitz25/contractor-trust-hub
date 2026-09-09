import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CoIndexRow = {
  p: string;
  n: string;
  e: string;
  s: string;
  c: string;
  st: string;
  z: string;
  i: string;
  x: string;
  v: string;
};

export type CoIdentityHit = {
  identity: string;
  prefix: string;
  number: string;
  name: string;
  status: string;
  city: string;
  state: string;
  zip: string;
  issued: string;
  expiration: string;
  verifyUrl: string;
  grain: "business_contractor_registration";
};

export type CoLookupQuery = {
  q: string;
  prefix: string;
  number: string;
  city: string;
  status: string;
};

export type CoLookupResult = {
  query: CoLookupQuery;
  hits: CoIdentityHit[];
  totalMatched: number;
  capped: boolean;
  cap: number;
  empty: boolean;
};

type IndexFile = { version: string; rows: CoIndexRow[] };

const RESULT_CAP = 25;
const BUSINESS_PREFIXES = new Set(["EC", "PC"]);
let FILE: IndexFile | null = null;

function loadIndex(): IndexFile {
  if (FILE) return FILE;
  FILE = JSON.parse(
    readFileSync(join(process.cwd(), "lib/colorado-intelligence/ec-pc-identity-index.json"), "utf8"),
  ) as IndexFile;
  return FILE;
}

function parseCredential(raw: string): { prefix: string; number: string; rest: string } {
  const t = raw.trim().toUpperCase();
  const m = t.match(/\b(EC|PC)\s*[-:]?\s*([0-9A-Z-]+)\b/);
  if (m) return { prefix: m[1], number: m[2], rest: t.replace(m[0], " ").trim() };
  return { prefix: "", number: "", rest: t };
}

function toHit(row: CoIndexRow): CoIdentityHit {
  return {
    identity: `CO-DORA:${row.p}:${row.n}`,
    prefix: row.p,
    number: row.n,
    name: row.e,
    status: row.s,
    city: row.c,
    state: row.st,
    zip: row.z,
    issued: row.i,
    expiration: row.x,
    verifyUrl: row.v,
    grain: "business_contractor_registration",
  };
}

export function lookupColoradoBusinessCredentials(input: {
  q?: string | null;
  prefix?: string | null;
  number?: string | null;
  city?: string | null;
  status?: string | null;
}): CoLookupResult {
  const q = (input.q || "").trim();
  const parsed = parseCredential(q);
  const prefix = (input.prefix || parsed.prefix).trim().toUpperCase();
  const number = (input.number || parsed.number).trim();
  const city = (input.city || "").trim();
  const status = (input.status || "").trim();
  const query: CoLookupQuery = { q, prefix, number, city, status };
  const empty = !q && !prefix && !number && !city && !status;
  if (empty) {
    return { query, hits: [], totalMatched: 0, capped: false, cap: RESULT_CAP, empty: true };
  }
  const nameQ = parsed.rest || (!parsed.prefix && !parsed.number ? q.toUpperCase() : "");
  const matched: CoIndexRow[] = [];
  for (const row of loadIndex().rows) {
    if (!BUSINESS_PREFIXES.has(row.p)) continue;
    if (prefix && row.p !== prefix) continue;
    if (number && row.n.toUpperCase() !== number.toUpperCase()) continue;
    if (city && !(row.c || "").toUpperCase().includes(city.toUpperCase())) continue;
    if (status && !(row.s || "").toUpperCase().includes(status.toUpperCase())) continue;
    if (nameQ) {
      const hay = `${row.e} ${row.p} ${row.n}`.toUpperCase();
      if (!hay.includes(nameQ)) continue;
    }
    matched.push(row);
  }
  matched.sort((a, b) => {
    const an = (a.e || "").toUpperCase();
    const bn = (b.e || "").toUpperCase();
    if (number && a.n.toUpperCase() === number.toUpperCase()) return -1;
    if (number && b.n.toUpperCase() === number.toUpperCase()) return 1;
    return an.localeCompare(bn);
  });
  return {
    query,
    hits: matched.slice(0, RESULT_CAP).map(toHit),
    totalMatched: matched.length,
    capped: matched.length > RESULT_CAP,
    cap: RESULT_CAP,
    empty: false,
  };
}
