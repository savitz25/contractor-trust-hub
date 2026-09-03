import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CA_LOCAL_PUBLIC_FINGERPRINT } from "./publication";

export type ExactLocalActivity = {
  license: string;
  caCslb: string;
  inAcquiredSpine: boolean;
  sfContacts: number;
  sfPermits: number;
  sfFirst: string | null;
  sfLast: string | null;
  laCofo: number;
  laPcis: number;
  laPermits: number;
  laFirst: string | null;
  laLast: string | null;
};

type IndexFile = {
  version: string;
  fingerprint: string;
  licenses: Record<
    string,
    {
      spine: boolean;
      sf_contacts: number;
      sf_permits: number;
      sf_first: string | null;
      sf_last: string | null;
      la_cofo: number;
      la_pcis: number;
      la_permits: number;
      la_first: string | null;
      la_last: string | null;
    }
  >;
};

let FILE: IndexFile | null = null;

function loadIndex(): IndexFile {
  if (FILE) return FILE;
  FILE = JSON.parse(
    readFileSync(join(process.cwd(), "lib/california-intelligence/local/exact-activity-index.json"), "utf8"),
  ) as IndexFile;
  return FILE;
}

export function lookupExactLocalActivity(raw: string | null | undefined): ExactLocalActivity | null {
  const file = loadIndex();
  if (file.fingerprint !== CA_LOCAL_PUBLIC_FINGERPRINT) {
    throw new Error("CA local activity index fingerprint mismatch");
  }
  const license = (raw || "").replace(/\D/g, "");
  if (license.length < 5) return null;
  const row = file.licenses[license];
  if (!row) return null;
  if (!row.sf_contacts && !row.la_cofo && !row.la_pcis) return null;
  return {
    license,
    caCslb: `CA-CSLB:${license}`,
    inAcquiredSpine: row.spine,
    sfContacts: row.sf_contacts,
    sfPermits: row.sf_permits,
    sfFirst: row.sf_first,
    sfLast: row.sf_last,
    laCofo: row.la_cofo,
    laPcis: row.la_pcis,
    laPermits: row.la_permits,
    laFirst: row.la_first,
    laLast: row.la_last,
  };
}

export function normalizeLicenseQuery(raw: string | null | undefined): string {
  return (raw || "").replace(/\D/g, "");
}
