import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WA_STATE_PUBLIC_FINGERPRINT } from "./publication";

export type WaBondRecord = {
  firm: string;
  amount: string;
  effective: string;
  expiration: string;
  cancel: string;
  impaired: string;
  filingClass: string;
};

export type WaInsuranceRecord = {
  company: string;
  policy: string;
  amount: string;
  effective: string;
  expiration: string;
  cancel: string;
  filingClass: string;
};

export type WaIdentityHit = {
  registration: string;
  waLni: string;
  company: string;
  ubi: string;
  city: string;
  zip: string;
  typeCode: string;
  status: string;
  phone: string;
  specialty: string;
  bondCount: number;
  insuranceCount: number;
  bonds: WaBondRecord[];
  insurance: WaInsuranceRecord[];
};

export type WaLookupQuery = {
  q: string;
  registration: string;
  ubi: string;
  city: string;
  zip: string;
  type: string;
  specialty: string;
  status: string;
};

export type WaLookupResult = {
  query: WaLookupQuery;
  hits: WaIdentityHit[];
  totalMatched: number;
  capped: boolean;
  cap: number;
  empty: boolean;
};

type IndexRow = {
  l: string;
  n: string;
  u: string;
  c: string;
  z: string;
  t: string;
  s: string;
  p: string;
  sp: string;
  bc: number;
  ic: number;
};

type IndexFile = {
  version: string;
  fingerprint: string;
  rows: number;
  i: IndexRow[];
  bond: Record<string, Array<[string, string, string, string, string, string, string]>>;
  insurance: Record<string, Array<[string, string, string, string, string, string, string]>>;
};

const RESULT_CAP = 25;
let FILE: IndexFile | null = null;

function loadIndex(): IndexFile {
  if (FILE) return FILE;
  FILE = JSON.parse(
    readFileSync(join(process.cwd(), "lib/washington-intelligence/identity-index.json"), "utf8"),
  ) as IndexFile;
  if (FILE.fingerprint !== WA_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("WA identity index fingerprint mismatch");
  }
  return FILE;
}

export function formatPhoneDisplay(phone: string): string {
  if (phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

function toBonds(lic: string, file: IndexFile): WaBondRecord[] {
  return (file.bond[lic] || []).map(([firm, amount, effective, expiration, cancel, impaired, filingClass]) => ({
    firm,
    amount,
    effective,
    expiration,
    cancel,
    impaired,
    filingClass,
  }));
}

function toIns(lic: string, file: IndexFile): WaInsuranceRecord[] {
  return (file.insurance[lic] || []).map(([company, policy, amount, effective, expiration, cancel, filingClass]) => ({
    company,
    policy,
    amount,
    effective,
    expiration,
    cancel,
    filingClass,
  }));
}

function toHit(row: IndexRow, file: IndexFile): WaIdentityHit {
  return {
    registration: row.l,
    waLni: `WA-LNI:${row.l}`,
    company: row.n,
    ubi: row.u,
    city: row.c,
    zip: row.z,
    typeCode: row.t,
    status: row.s,
    phone: row.p,
    specialty: row.sp,
    bondCount: row.bc,
    insuranceCount: row.ic,
    bonds: toBonds(row.l, file),
    insurance: toIns(row.l, file),
  };
}

function relevance(q: string, row: IndexRow): number {
  const name = (row.n || "").toUpperCase();
  const lic = (row.l || "").toUpperCase();
  if (lic === q || name === q) return 0;
  if (lic.startsWith(q) || name.startsWith(q)) return 1;
  if (lic.includes(q) || name.includes(q)) return 2;
  return 9;
}

export function lookupWashingtonIdentities(input: {
  q?: string | null;
  registration?: string | null;
  ubi?: string | null;
  city?: string | null;
  zip?: string | null;
  type?: string | null;
  specialty?: string | null;
  status?: string | null;
}): WaLookupResult {
  const q = (input.q || "").trim();
  const registration = (input.registration || "").trim();
  const ubi = (input.ubi || "").replace(/\D+/g, "");
  const city = (input.city || "").trim();
  const zip = (input.zip || "").replace(/\D+/g, "").slice(0, 5);
  const type = (input.type || "").trim();
  const specialty = (input.specialty || "").trim();
  const status = (input.status || "").trim();
  const query: WaLookupQuery = { q, registration, ubi, city, zip, type, specialty, status };
  const empty = !q && !registration && !ubi && !city && !zip && !type && !specialty && !status;
  if (empty) {
    return { query, hits: [], totalMatched: 0, capped: false, cap: RESULT_CAP, empty: true };
  }

  const file = loadIndex();
  const qU = q.toUpperCase();
  const qDigits = q.replace(/\D+/g, "");
  const regU = registration.toUpperCase();
  const cityU = city.toUpperCase();
  const typeU = type.toUpperCase();
  const specU = specialty.toUpperCase();
  const statusU = status.toUpperCase();

  const matched: IndexRow[] = [];
  for (const row of file.i) {
    if (regU && (row.l || "").toUpperCase() !== regU) continue;
    if (ubi && row.u !== ubi) continue;
    if (zip && row.z !== zip) continue;
    if (cityU && !(row.c || "").toUpperCase().includes(cityU)) continue;
    if (typeU && (row.t || "").toUpperCase() !== typeU && !(row.t || "").toUpperCase().includes(typeU)) continue;
    if (statusU && (row.s || "").toUpperCase() !== statusU) continue;
    if (specU && !(row.sp || "").toUpperCase().includes(specU)) continue;
    if (qU) {
      const name = (row.n || "").toUpperCase();
      const lic = (row.l || "").toUpperCase();
      const ok =
        lic === qU ||
        lic.includes(qU) ||
        name.includes(qU) ||
        (qDigits.length >= 6 && (row.u === qDigits || row.p === qDigits));
      if (!ok) continue;
    }
    matched.push(row);
  }

  matched.sort((a, b) => {
    if (qU) {
      const ra = relevance(qU, a);
      const rb = relevance(qU, b);
      if (ra !== rb) return ra - rb;
    }
    const byName = a.n.localeCompare(b.n, "en", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.l.localeCompare(b.l);
  });

  const totalMatched = matched.length;
  return {
    query,
    hits: matched.slice(0, RESULT_CAP).map((row) => toHit(row, file)),
    totalMatched,
    capped: totalMatched > RESULT_CAP,
    cap: RESULT_CAP,
    empty: false,
  };
}
