import "server-only";
import { query } from "@/lib/db";

// This is an allowlist of the five independently verified ingest batches.
// Changing the flag alone cannot expose another source or an attached business license.
export const CERTIFIED_BATCHES = [
  "e3e1c7c3-e337-5bc4-8143-4631415db763", // FL electrical Board 08
  "1a89ece4-7f97-576c-a639-ca15316054c5", // FL mold Board 07
  "20a365ff-a740-515d-bd96-574809e62a4d", // FL home inspector Board 04
  "637955be-0fc3-5beb-aa6f-52904f3184f0", // NY DOL mold
  "cf41ef92-452b-553d-927e-f3944c3d2dfd", // NY DOL elevator
] as const;

export const CERTIFIED_TOTAL = 35373;
export const CREDENTIAL_PUBLICATION_FLAG = "certified-2026-10-01";

export function credentialsPublished() {
  return process.env.CONTRACTOR_CREDENTIAL_PUBLICATION_BATCH === CREDENTIAL_PUBLICATION_FLAG;
}

export type Credential = {
  id: string;
  source_system: string;
  external_key: string;
  occupation_code: string | null;
  occupation_description: string | null;
  license_number: string;
  licensee_name_raw: string | null;
  primary_status: string | null;
  original_licensure_date: string | null;
  expiration_date: string | null;
  closed_date: string | null;
  source_url: string | null;
  source_date: string | null;
  source_dataset: string;
  batch_id: string;
};

export function credentialLabel(row: Pick<Credential, "source_dataset" | "occupation_code">) {
  if (row.source_dataset === "fl_dbpr_eclb_08") return "Florida Electrical License";
  if (row.source_dataset === "fl_dbpr_mold_07") {
    return row.occupation_code === "MRSA" ? "Florida Mold Assessor License" : "Florida Mold Remediator License";
  }
  if (row.source_dataset === "fl_dbpr_home_04") return "Florida Home Inspector License";
  if (row.source_dataset === "ny_dol_mold") return "New York Mold License";
  return "New York Elevator Contractor License";
}

export function credentialJurisdiction(row: Pick<Credential, "source_dataset">) {
  return row.source_dataset.startsWith("fl_") ? "Florida" : "New York";
}

export function credentialRegulator(row: Pick<Credential, "source_dataset">) {
  return row.source_dataset.startsWith("fl_") ? "Florida DBPR" : "New York State Department of Labor";
}

export function credentialGrain(row: Pick<Credential, "source_dataset">) {
  return row.source_dataset.startsWith("fl_") ? "Person credential record" : "Regulatory credential record";
}

const fields = `l.id::text, l.source_system, l.external_key, l.occupation_code,
  l.occupation_description, l.license_number, l.licensee_name_raw, l.primary_status,
  l.original_licensure_date::text, l.expiration_date::text,
  COALESCE(l.raw_payload->>'closed_date', l.raw_payload->>'date_closed') AS closed_date,
  b.source_url, l.last_verified_at::date::text AS source_date,
  b.source_dataset, b.id::text AS batch_id`;

const allowlist = `l.ingest_batch_id = ANY($1::uuid[]) AND l.contractor_id IS NULL
  AND ((b.source_dataset = 'fl_dbpr_eclb_08' AND l.source_system = 'fl_dbpr')
    OR (b.source_dataset = 'fl_dbpr_mold_07' AND l.source_system = 'fl_dbpr' AND l.occupation_code IN ('MRSA','MRSR'))
    OR (b.source_dataset = 'fl_dbpr_home_04' AND l.source_system = 'fl_dbpr')
    OR (b.source_dataset = 'ny_dol_mold' AND l.source_system = 'ny_dol')
    OR (b.source_dataset = 'ny_elevator' AND l.source_system = 'ny_dol'))`;

export async function searchCredentials(filters: { q?: string; state?: string; type?: string; status?: string }) {
  if (!credentialsPublished()) return [];
  const q = (filters.q || "").trim().slice(0, 120);
  const state = filters.state === "FL" || filters.state === "NY" ? filters.state : "";
  const type = ["fl_dbpr_eclb_08", "fl_mrsa", "fl_mrsr", "fl_dbpr_home_04", "ny_dol_mold", "ny_elevator"].includes(filters.type || "") ? filters.type : "";
  const status = (filters.status || "").trim().slice(0, 40);
  if (!q || q.length < 2) return [];
  const escaped = q.replace(/[\\%_]/g, "\\$&");
  return query<Credential>(`
    SELECT ${fields} FROM public.licenses l
    JOIN public.ingest_batches b ON b.id = l.ingest_batch_id
    WHERE ${allowlist}
      AND ($2 = '' OR ($2 = 'FL' AND b.source_dataset LIKE 'fl_dbpr_%')
        OR ($2 = 'NY' AND b.source_dataset IN ('ny_dol_mold','ny_elevator')))
      AND ($3 = '' OR b.source_dataset = $3
        OR ($3 = 'fl_mrsa' AND b.source_dataset = 'fl_dbpr_mold_07' AND l.occupation_code = 'MRSA')
        OR ($3 = 'fl_mrsr' AND b.source_dataset = 'fl_dbpr_mold_07' AND l.occupation_code = 'MRSR'))
      AND ($4 = '' OR l.primary_status = $4)
      AND (l.license_number ILIKE $5 ESCAPE '\\'
        OR l.licensee_name_raw ILIKE $5 ESCAPE '\\')
    ORDER BY CASE WHEN lower(l.license_number) = lower($6) THEN 0 ELSE 1 END,
      l.licensee_name_raw, l.external_key LIMIT 50`,
    [[...CERTIFIED_BATCHES], state, type, status, `%${escaped}%`, q]
  );
}

export async function credentialById(id: string) {
  if (!credentialsPublished() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<Credential>(`
    SELECT ${fields} FROM public.licenses l
    JOIN public.ingest_batches b ON b.id = l.ingest_batch_id
    WHERE ${allowlist} AND l.id = $2::uuid LIMIT 1`, [[...CERTIFIED_BATCHES], id]);
  return rows[0] || null;
}
