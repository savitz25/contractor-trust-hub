import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const root = new URL("../lib/connecticut-intelligence/", import.meta.url);
const credentialsId = "ngch-56tr";
const decisionsId = "2twc-xaxs";
const end = "2026-09-28";
const classes = [
  "HOME IMPROVEMENT CONTRACTOR",
  "HOME IMPROVEMENT SALESPERSON",
  "NEW HOME CONSTRUCTION CONTRACTOR",
  "ELECTRICAL LIMITED CONTRACTOR",
  "ELECTRICAL UNLIMITED CONTRACTOR",
  "PLUMBING & PIPING LIMITED CONTRACTOR",
  "PLUMBING & PIPING UNLIMITED CONTRACTOR",
  "HEATING, PIPING & COOLING LIMITED CONTRACTOR",
  "HEATING, PIPING & COOLING UNLIMITED CONTRACTOR",
  "FIRE PROTECTION LIMITED CONTRACTOR",
  "FIRE PROTECTION UNLIMITED CONTRACTOR",
  "SHEET METAL LIMITED CONTRACTOR",
  "ELEVATOR LIMITED CONTRACTOR",
  "ELEVATOR UNLIMITED CONTRACTOR",
];
const sqlQuote = (s) => `'${s.replaceAll("'", "''")}'`;

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "ContractorTrustHub CT-CON-001 public-data snapshot" } });
  if (!response.ok) throw new Error(`${response.status} ${url}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}
async function soda(id, params) {
  const url = new URL(`https://data.ct.gov/resource/${id}.json`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return getJson(url);
}
async function all(id, params, chunk = 50000) {
  const rows = [];
  for (let offset = 0;; offset += chunk) {
    const batch = await soda(id, { ...params, $limit: chunk, $offset: offset });
    rows.push(...batch);
    if (batch.length < chunk) break;
  }
  return rows;
}

const credentialMeta = await getJson(`https://data.ct.gov/api/views/${credentialsId}.json`);
const decisionMeta = await getJson(`https://data.ct.gov/api/views/${decisionsId}.json`);
const classWhere = `credential in(${classes.map(sqlQuote).join(",")})`;
const grouped = await all(credentialsId, {
  $select: "credential,type,status,active,count(*) as rows,count(distinct fullcredentialcode) as distinct_credentials",
  $where: classWhere,
  $group: "credential,type,status,active",
  $order: "credential,type,status,active",
});
const coreWhere = `credential in('HOME IMPROVEMENT CONTRACTOR','NEW HOME CONSTRUCTION CONTRACTOR') and active=1`;
const coreRaw = await all(credentialsId, {
  $select: "fullcredentialcode,credential,type,name,businessname,status,active,issuedate,expirationdate,city",
  $where: coreWhere,
  $order: "fullcredentialcode",
});
const core = coreRaw.map((r) => ({
  number: r.fullcredentialcode,
  class: r.credential,
  holderType: r.type ?? "UNSPECIFIED",
  // Individual records can contain a residential address/name; do not ship them.
  businessName: /^(?:CORPORATION|LIMITED LIABILITY|PARTNERSHIP|COMPANY)/.test(r.type ?? "") ? (r.businessname || r.name || null) : null,
  status: r.status,
  activeFlag: r.active === "1",
  issueDate: r.issuedate?.slice(0, 10) ?? null,
  expirationDate: r.expirationdate?.slice(0, 10) ?? null,
  city: /^(?:CORPORATION|LIMITED LIABILITY|PARTNERSHIP|COMPANY)/.test(r.type ?? "") ? (r.city ?? null) : null,
}));
assert.equal(new Set(core.map((r) => r.number)).size, core.length, "core credential numbers must be unique");
const decisionRaw = await all(decisionsId, {
  $where: `decision_date between '2022-01-01' and '${end}' and shortname in('HOME IMPRV AND NEW HOME CNSTR','OCCUPATIONAL')`,
  $order: "decision_date DESC,case_number",
});
const occupational = /^(?:ELC|HTG|PLM|HIC|NHC|SMT|FSP|ELV)\./i;
const decisions = decisionRaw.filter((r) => r.shortname !== "OCCUPATIONAL" || occupational.test(r.credential_number ?? ""))
  .map((r) => ({
    category: r.shortname,
    caseNumber: r.case_number,
    decisionDate: r.decision_date,
    respondent: r.respondent,
    credentialNumber: r.credential_number ?? null,
    decisionUrl: r.decision_links?.url ?? null,
    additionalUrl: r.additional_docs?.url ?? null,
    sourceLabel: r.decision_links?.description ?? null,
  }));
const numbers = [...new Set(decisions.map((r) => r.credentialNumber).filter(Boolean))];
const matched = await all(credentialsId, {
  $select: "fullcredentialcode,credential,type,status",
  $where: `fullcredentialcode in(${numbers.map(sqlQuote).join(",")})`,
  $order: "fullcredentialcode",
});
const matchedByNumber = new Map(matched.map((r) => [r.fullcredentialcode, r]));
for (const row of decisions) {
  const credential = matchedByNumber.get(row.credentialNumber);
  row.exactCredentialMatch = Boolean(credential);
  row.matchedClass = credential?.credential ?? null;
  row.matchedHolderType = credential?.type ?? null;
}
const snapshot = {
  source: { url: `https://data.ct.gov/Business/State-Licenses-and-Credentials/${credentialsId}`, datasetId: credentialsId,
    rowsUpdatedAt: new Date(credentialMeta.rowsUpdatedAt * 1000).toISOString(), retrievedAt: new Date().toISOString() },
  decisionSource: { url: `https://data.ct.gov/Government/DCP-Legal-Administrative-Decisions/${decisionsId}`, datasetId: decisionsId,
    rowsUpdatedAt: new Date(decisionMeta.rowsUpdatedAt * 1000).toISOString(), retrievedAt: new Date().toISOString(), windowStart: "2022-01-01", windowEnd: end },
  classes, grouped: grouped.map((r) => ({ class: r.credential, holderType: r.type ?? "UNSPECIFIED", status: r.status ?? "UNSPECIFIED", activeFlag: r.active === "1", rows: Number(r.rows), distinctCredentials: Number(r.distinct_credentials) })),
  core,
  decisions,
  limits: { graphWrites: 0, newCanonicalCompanies: 0, nameOnlyAdverseJoins: 0, claimEligibilityBroadened: false,
    providerComplaintRows: null, guarantyProviderRows: null, decisionCorpusIsCensus: false },
};
assert(snapshot.grouped.length > 0 && core.length > 0 && decisions.length > 0);
await mkdir(root, { recursive: true });
await writeFile(new URL("snapshot.json", root), JSON.stringify(snapshot));
console.log(JSON.stringify({ core: core.length, decisionRows: decisions.length, exactMatches: decisions.filter((r) => r.exactCredentialMatch).length, groups: grouped.length, sourceClock: snapshot.source.rowsUpdatedAt }));
