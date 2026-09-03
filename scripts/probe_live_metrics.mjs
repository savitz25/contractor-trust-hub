import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(join(root, ".env.local"));
loadEnv("C:\\Users\\makei\\contractor-trust-hub\\.env.local");

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !key) {
  console.log(JSON.stringify({ error: "missing supabase env", hasUrl: Boolean(base), hasKey: Boolean(key) }));
  process.exit(2);
}

async function restCount(table, query = "") {
  const url = `${base}/rest/v1/${table}?select=*${query ? `&${query}` : ""}`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
      "Range-Unit": "items",
    },
  });
  const t = await res.text();
  if (!res.ok && res.status !== 206 && res.status !== 416) {
    return { table, query, error: `${res.status} ${t.slice(0, 180)}` };
  }
  const tail = (res.headers.get("content-range") || "").split("/")[1];
  return { table, query, n: tail && tail !== "*" ? Number(tail) : 0 };
}

const live = [
  "az_roc",
  "ca_cslb",
  "fl_dbpr",
  "ky_dhbc",
  "la_lslbc",
  "ms_sbc",
  "nj_dca",
  "or_ccb",
  "tx_tdlr",
  "tx_tsbpe",
  "wa_lni",
];
const inLive = `source_system=in.(${live.join(",")})`;
const extras = ["ct_dcp", "id_dopl", "mn_dli", "nv_nscb", "ok_cib", "tn_blc", "va_dpor", "wi_dsps"];

const jobs = [
  restCount("licenses"),
  restCount("licenses", inLive),
  restCount("licenses", `${inLive}&status_normalized=in.(active,current)`),
  restCount("contractors"),
  restCount("discipline_actions"),
  restCount("regulatory_source_observations"),
  restCount("regulatory_source_occurrences"),
  restCount("permit_source_records"),
  restCount("public_contact_observations"),
  restCount("contractor_entities"),
  ...live.map((s) => restCount("licenses", `source_system=eq.${s}`)),
  ...extras.map((s) => restCount("licenses", `source_system=eq.${s}`)),
];

const rows = [];
for (const job of jobs) rows.push(await job);
console.log(JSON.stringify(rows, null, 2));
