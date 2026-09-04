import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TX_AUSTIN_PUBLIC_FINGERPRINT } from "./publication";

export type AustinRecentPermit = {
  permit: string;
  type: string;
  date: string;
  status: string;
};

export type AustinIdentityHit = {
  company: string;
  phone: string;
  address: string;
  zip: string;
  trades: string[];
  permitCount: number;
  firstIssued: string;
  lastIssued: string;
  recent: AustinRecentPermit[];
  identityKey: "AUSTIN_PERMIT_CONTRACTOR_IDENTITY";
};

export type AustinLookupQuery = {
  company: string;
  phone: string;
  permit: string;
  trade: string;
  zip: string;
};

export type AustinLookupResult = {
  query: AustinLookupQuery;
  hits: AustinIdentityHit[];
  totalMatched: number;
  capped: boolean;
  cap: number;
  completePermitDirectory: false;
  empty: boolean;
};

type IndexRow = {
  c: string;
  p: string;
  a: string;
  z: string;
  t: string[];
  n: number;
  f: string;
  l: string;
  r: Array<[string, string, string, string]>;
};

type IndexFile = {
  version: string;
  fingerprint: string;
  identity_key: string;
  rows: number;
  recent_cap: number;
  i: IndexRow[];
};

const RESULT_CAP = 25;
const PUNCT = /[^A-Z0-9 ]+/g;
const SPACES = /\s+/g;
const LEGAL = /\b(INCORPORATED|INC|LLC|L L C|CORPORATION|CORP|CO|COMPANY|LTD|LIMITED|LP|LLP|DBA|THE)\b/g;

let FILE: IndexFile | null = null;

function loadIndex(): IndexFile {
  if (FILE) return FILE;
  FILE = JSON.parse(
    readFileSync(join(process.cwd(), "lib/texas-intelligence/local/identity-index.json"), "utf8"),
  ) as IndexFile;
  if (FILE.fingerprint !== TX_AUSTIN_PUBLIC_FINGERPRINT) {
    throw new Error("TX Austin identity index fingerprint mismatch");
  }
  return FILE;
}

export function normCompanyQuery(raw: string | null | undefined): string {
  const s = (raw || "").toUpperCase().replace(PUNCT, " ").replace(LEGAL, " ").replace(SPACES, " ").trim();
  return s;
}

export function normPhoneQuery(raw: string | null | undefined): string {
  let d = (raw || "").replace(/\D+/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : d;
}

export function formatPhoneDisplay(phone: string): string {
  if (phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

function toHit(row: IndexRow): AustinIdentityHit {
  return {
    company: row.c,
    phone: row.p,
    address: row.a || "",
    zip: row.z || "",
    trades: row.t || [],
    permitCount: row.n,
    firstIssued: row.f || "",
    lastIssued: row.l || "",
    recent: (row.r || []).map(([permit, type, date, status]) => ({ permit, type, date, status })),
    identityKey: "AUSTIN_PERMIT_CONTRACTOR_IDENTITY",
  };
}

function relevance(normCompany: string, row: IndexRow): number {
  const n = normCompanyQuery(row.c);
  if (n === normCompany) return 0;
  if (n.startsWith(normCompany)) return 1;
  if (n.includes(normCompany)) return 2;
  return 9;
}

export function lookupAustinIdentities(input: {
  company?: string | null;
  phone?: string | null;
  permit?: string | null;
  trade?: string | null;
  zip?: string | null;
}): AustinLookupResult {
  const company = (input.company || "").trim();
  const phoneRaw = (input.phone || "").trim();
  const permit = (input.permit || "").trim();
  const trade = (input.trade || "").trim();
  const zip = (input.zip || "").replace(/\D+/g, "").slice(0, 5);
  const query: AustinLookupQuery = { company, phone: phoneRaw, permit, trade, zip };
  const empty = !company && !phoneRaw && !permit && !trade && !zip;
  if (empty) {
    return {
      query,
      hits: [],
      totalMatched: 0,
      capped: false,
      cap: RESULT_CAP,
      completePermitDirectory: false,
      empty: true,
    };
  }

  const file = loadIndex();
  const nCompany = normCompanyQuery(company);
  const nPhone = normPhoneQuery(phoneRaw);
  const nPermit = permit.toUpperCase();
  const nTrade = trade.toUpperCase();

  const matched: IndexRow[] = [];
  for (const row of file.i) {
    if (nPhone && nPhone.length === 10 && row.p !== nPhone) continue;
    if (nPhone && nPhone.length && nPhone.length !== 10 && !row.p.includes(nPhone)) continue;
    if (zip && row.z !== zip) continue;
    if (nTrade) {
      const trades = (row.t || []).join(" ").toUpperCase();
      if (!trades.includes(nTrade)) continue;
    }
    if (nCompany) {
      const n = normCompanyQuery(row.c);
      if (!n.includes(nCompany)) continue;
    }
    if (nPermit) {
      const hitPermit = (row.r || []).some(([p]) => (p || "").toUpperCase() === nPermit);
      if (!hitPermit) continue;
    }
    matched.push(row);
  }

  matched.sort((a, b) => {
    if (nCompany) {
      const ra = relevance(nCompany, a);
      const rb = relevance(nCompany, b);
      if (ra !== rb) return ra - rb;
    }
    const byName = a.c.localeCompare(b.c, "en", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.p.localeCompare(b.p);
  });

  const totalMatched = matched.length;
  const hits = matched.slice(0, RESULT_CAP).map(toHit);
  return {
    query,
    hits,
    totalMatched,
    capped: totalMatched > RESULT_CAP,
    cap: RESULT_CAP,
    completePermitDirectory: false,
    empty: false,
  };
}
