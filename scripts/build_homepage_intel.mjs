/**
 * Build contractor-hub-intel-v2 from production.
 * Live source cohort is parsed from lib/states/config.ts (same file Verify uses).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
async function restCount(base, key, table, query = "") {
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
  if (!res.ok && res.status !== 206 && res.status !== 416) {
    const t = await res.text();
    if (res.status === 404 || /does not exist|Could not find/i.test(t)) return 0;
    if (/statement timeout|57014/i.test(t)) return -1;
    throw new Error(`${table} ${res.status} ${t.slice(0, 200)}`);
  }
  const cr = res.headers.get("content-range") || "";
  const tail = cr.split("/")[1];
  return tail && tail !== "*" ? Number(tail) : 0;
}

async function restGroupCount(base, key, table, column, values) {
  const out = {};
  for (const v of values) {
    out[v] = await restCount(base, key, table, `${column}=eq.${encodeURIComponent(v)}`);
  }
  return out;
}

async function restStatus(base, key, liveSources) {
  const keys = ["active", "current", "inactive", "expired", "suspended", "revoked", "unlicensed"];
  const out = {
    active: 0,
    current: 0,
    inactive: 0,
    expired: 0,
    suspended: 0,
    revoked: 0,
    unlicensed: 0,
    other: 0,
  };
  const prefix = liveSources ? `source_system=in.(${liveSources.join(",")})&` : "";
  const total = await restCount(base, key, "licenses", prefix.replace(/&$/, ""));
  let known = 0;
  for (const s of keys) {
    const n = await restCount(base, key, "licenses", `${prefix}status_normalized=eq.${s}`);
    out[s] = n;
    known += n;
  }
  out.other = Math.max(0, total - known);
  return out;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

function liveCohortFromConfig() {
  const src = readFileSync(join(root, "lib/states/config.ts"), "utf8");
  const orderMatch = src.match(/LIVE_STATE_ORDER = \[([^\]]+)\]/);
  if (!orderMatch) throw new Error("LIVE_STATE_ORDER missing");
  const order = [...orderMatch[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  const codes = [];
  const sources = [];
  const slugToCode = { fl: "FL", tx: "TX", nj: "NJ", or: "OR", wa: "WA", ca: "CA", az: "AZ", la: "LA", ms: "MS", ky: "KY", wi: "WI" };
  for (const slug of order) {
    const re = new RegExp(`\\n  ${slug}: \\{([\\s\\S]*?)\\n  \\},`);
    const block = src.match(re)?.[1];
    if (!block) throw new Error(`state block missing: ${slug}`);
    if (!/live:\s*true/.test(block)) continue;
    codes.push(slugToCode[slug] || slug.toUpperCase());
    const multi = block.match(/licenseSources:\s*\[([^\]]+)\]/);
    if (multi) {
      sources.push(...[...multi[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    } else {
      const one = block.match(/licenseSource:\s*"([^"]+)"/);
      if (!one) throw new Error(`licenseSource missing: ${slug}`);
      sources.push(one[1]);
    }
  }
  return {
    liveStates: codes.length,
    liveStateCodes: codes,
    liveSourceSystems: [...new Set(sources)].sort(),
  };
}

function familyLabel(sourceSystem, sourceDataset) {
  const ds = String(sourceDataset || "").toLowerCase();
  const sys = String(sourceSystem || "").toLowerCase();
  if (sys === "fl_dfs" || ds.includes("stop") || ds.includes("swa")) {
    return { key: "fl_dfs_stop_work", label: "Florida DFS workers' compensation stop-work records" };
  }
  if (sys === "fl_dbpr" && (ds.includes("ula") || ds.includes("unlicensed"))) {
    return { key: "fl_dbpr_unlicensed", label: "Florida DBPR unlicensed activity" };
  }
  if (sys === "fl_dbpr" && (ds.includes("rf") || ds.includes("recovery") || ds.includes("crf"))) {
    return { key: "fl_recovery_fund", label: "Florida Construction Recovery Fund" };
  }
  if (sys === "fl_dbpr" && (ds.includes("disc_lic") || ds.includes("discipline"))) {
    return { key: "fl_dbpr_discipline", label: "Florida DBPR licensing discipline" };
  }
  if (sys === "fl_dbpr") {
    return { key: "fl_dbpr_other", label: "Florida DBPR other regulatory rows" };
  }
  if (sys.includes("nj")) {
    return { key: "nj_enforcement", label: "New Jersey enforcement / discipline flags" };
  }
  if (sys === "az_roc") {
    return { key: "az_roc_discipline", label: "Arizona ROC disciplinary actions" };
  }
  return {
    key: `${sys}:${ds || "unknown"}`,
    label: `${sourceSystem}${sourceDataset ? ` / ${sourceDataset}` : ""}`,
  };
}

async function tableExists(client, name) {
  const r = await client.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
  return Boolean(r.rows[0]?.t);
}

async function countTable(client, name) {
  if (!(await tableExists(client, name))) return 0;
  const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${name}`);
  return Number(r.rows[0].n);
}

function emptyStatus() {
  return { active: 0, current: 0, inactive: 0, expired: 0, suspended: 0, revoked: 0, unlicensed: 0, other: 0 };
}

async function statusBreak(client, liveSources) {
  const out = emptyStatus();
  const sql = liveSources
    ? `SELECT COALESCE(status_normalized, 'unknown') AS s, COUNT(*)::int AS n
       FROM licenses WHERE source_system = ANY($1::text[]) GROUP BY 1`
    : `SELECT COALESCE(status_normalized, 'unknown') AS s, COUNT(*)::int AS n FROM licenses GROUP BY 1`;
  const r = liveSources ? await client.query(sql, [liveSources]) : await client.query(sql);
  const known = new Set(["active", "current", "inactive", "expired", "suspended", "revoked", "unlicensed"]);
  for (const row of r.rows) {
    const key = String(row.s || "other").toLowerCase();
    const n = Number(row.n);
    if (known.has(key)) out[key] += n;
    else out.other += n;
  }
  return out;
}

async function main() {
  loadEnv();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("Supabase URL/key missing");
  const cohort = liveCohortFromConfig();
  const tradesDoc = JSON.parse(readFileSync(join(root, "lib/home/trade-families.json"), "utf8"));
  const count = (table, q = "") => restCount(base, key, table, q);
  try {
    const generatedAt = new Date().toISOString();
    const liveSources = cohort.liveSourceSystems;
    const inLive = `source_system=in.(${liveSources.join(",")})`;

    const contractors = await count("contractors");
    const licenses = await count("licenses");
    const candidateSources = [
      ...liveSources,
      "fl_sunbiz",
      "fl_dfs",
      "wi_dsps",
      "nj_enforcement",
      "az_roc_discipline",
      "tx_tsbpe",
      "oh_cslb",
      "nv_nscb",
      "ga_sclb",
      "nc_nclbgc",
      "sc_llr",
      "al_lirb",
      "tn_commerce",
      "va_dpor",
      "md_dllr",
      "pa_lni",
      "il_idfpr",
      "in_pla",
      "mi_lara",
      "co_dora",
      "ut_doppl",
      "nm_cid",
      "ok_cclb",
    ];
    const bySrc = await restGroupCount(base, key, "licenses", "source_system", [...new Set(candidateSources)]);
    const sourceKeys = Object.entries(bySrc)
      .filter(([, n]) => n > 0)
      .map(([k]) => k)
      .sort();
    const licenseSourceSystems = sourceKeys.length;
    const contractorEntities = await count("contractor_entities");
    const entities = contractorEntities > 0 ? 0 : await count("entities");
    const entityLinks = contractorEntities > 0 ? contractorEntities : Math.max(0, entities);
    const contacts = await count("public_contact_observations");
    const actions = await count("discipline_actions");
    const observations = await count("regulatory_source_observations");
    const occurrences = await count("regulatory_source_occurrences");
    const permits = await count("permit_source_records");

    const liveCred = await count("licenses", inLive);
    const liveActive = await count(
      "licenses",
      `${inLive}&status_normalized=in.(active,current)`
    );

    const discSystems = ["fl_dbpr", "fl_dfs", "nj_dca", "nj_enforcement", "az_roc"];
    const discDatasets = [
      "contractor_disc_lic",
      "contractor_disc_ula",
      "contractor_disc_rf",
      "fl_dfs_workers_comp_stop_work",
      "disciplinary_actions",
    ];
    const familyMap = new Map();
    let attributed = 0;
    for (const sys of discSystems) {
      const sysN = await count("discipline_actions", `source_system=eq.${sys}`);
      if (!sysN) continue;
      let used = 0;
      for (const ds of discDatasets.filter(Boolean)) {
        const n = await count(
          "discipline_actions",
          `source_system=eq.${sys}&source_dataset=eq.${ds}`
        );
        if (!n) continue;
        used += n;
        const meta = familyLabel(sys, ds);
        const prev = familyMap.get(meta.key);
        if (prev) prev.rows += n;
        else {
          familyMap.set(meta.key, {
            key: meta.key,
            label: meta.label,
            sourceSystem: sys,
            sourceDataset: ds,
            rows: n,
          });
        }
      }
      const rest = sysN - used;
      if (rest > 0) {
        const meta = familyLabel(sys, "");
        const prev = familyMap.get(meta.key);
        if (prev) prev.rows += rest;
        else {
          familyMap.set(meta.key, {
            key: meta.key,
            label: meta.label,
            sourceSystem: sys,
            sourceDataset: "",
            rows: rest,
          });
        }
      }
      attributed += sysN;
    }
    if (attributed < actions) {
      familyMap.set("other_discipline", {
        key: "other_discipline",
        label: "Other regulatory / enforcement source rows",
        sourceSystem: "other",
        sourceDataset: "",
        rows: actions - attributed,
      });
    }
    const byEvidenceFamily = [...familyMap.values()].sort((a, b) => b.rows - a.rows);
    const familySum = byEvidenceFamily.reduce((s, f) => s + f.rows, 0);
    if (familySum !== actions) {
      throw new Error(`discipline family sum ${familySum} !== actions ${actions}`);
    }

    const tradeFamilies = [];
    for (const fam of tradesDoc.families) {
      let credentialRows = 0;
      let activeCurrentRows = 0;
      const contributingSources = [];
      const occupationCodes = [];
      const origin = [];
      for (const member of fam.members) {
        if (!liveSources.includes(member.sourceSystem)) continue;
        const codes = member.occupationCodes.map((c) => String(c).toUpperCase());
        const inCodes = `occupation_code=in.(${codes
          .map((c) => (/[^A-Z0-9_]/i.test(c) ? `"${c}"` : c))
          .join(",")})`;
        const n = await count(
          "licenses",
          `source_system=eq.${member.sourceSystem}&${inCodes}`
        );
        const ac = await count(
          "licenses",
          `source_system=eq.${member.sourceSystem}&${inCodes}&status_normalized=in.(active,current)`
        );
        credentialRows += n;
        activeCurrentRows += ac;
        if (n > 0) contributingSources.push(member.sourceSystem);
        occupationCodes.push(...codes.map((c) => `${member.sourceSystem}:${c}`));
        origin.push(member.origin);
      }
      tradeFamilies.push({
        id: fam.id,
        label: fam.label,
        href: fam.href,
        credentialRows,
        activeCurrentRows,
        contributingSources: [...new Set(contributingSources)],
        occupationCodes,
        origin: [...new Set(origin)],
      });
    }

    const publicCoverage = {
      liveStates: cohort.liveStates,
      liveStateCodes: cohort.liveStateCodes,
      liveSourceSystems: liveSources,
      credentialRecords: liveCred,
      activeCurrentCredentialRecords: liveActive,
      cohortRule:
        "licenses.source_system IN live sources parsed from lib/states/config.ts (EVIDENCE_STATES live:true + licenseSource/licenseSources, LIVE_STATE_ORDER)",
      activeCurrentRule: "status_normalized IN ('active','current') within the live source cohort",
    };

    if (publicCoverage.activeCurrentCredentialRecords > publicCoverage.credentialRecords) {
      throw new Error("active/current exceeds live credential denominator");
    }

    const canonical = {
      liveStates: publicCoverage.liveStates,
      liveSources,
      liveCredentials: publicCoverage.credentialRecords,
      liveActiveCurrent: publicCoverage.activeCurrentCredentialRecords,
      contractors,
      licenses,
      sourceSystems: licenseSourceSystems,
      actions,
      observations,
      occurrences,
      entityLinks,
      permits,
      contacts,
    };
    const sourceFingerprint = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");

    const snap = {
      schemaVersion: "contractor-hub-intel-v2",
      generatedAt,
      sourceFingerprint,
      publicCoverage,
      researchGraph: {
        contractorIdentityRows: contractors,
        licenseRows: licenses,
        licenseSourceSystems: licenseSourceSystems,
        licenseSourceSystemKeys: sourceKeys,
        entityLinks,
        publicContactObservations: contacts,
        note: "Research-graph totals are not currently public live coverage and must not be advertised as a U.S. contractor census.",
      },
      regulatoryEvidence: {
        totalActionRows: actions,
        canonicalObservations: observations,
        occurrences,
        byEvidenceFamily,
        grainNote:
          "totalActionRows is discipline_actions. Observations and occurrences are different grains and are not added to the action total.",
      },
      licensingStatus: {
        denominator: "research_graph_licenses",
        graph: await restStatus(base, key, null),
        liveCohort: await restStatus(base, key, liveSources),
      },
      permits: {
        sourceRecords: permits,
        grain: "permit_source_records indexed — not jobs completed and not nationwide contractor volume",
      },
      tradeFamilies: {
        canonicalNormalizationExisted: tradesDoc.canonicalNormalizationExisted,
        note: tradesDoc.note,
        families: tradeFamilies,
      },
    };

    const outDir = join(root, "data", "home");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "contractor-hub-intel-v2.json");
    writeFileSync(outPath, `${JSON.stringify(snap, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify(
        {
          wrote: "data/home/contractor-hub-intel-v2.json",
          fingerprint: sourceFingerprint,
          publicCoverage,
          researchGraph: snap.researchGraph,
          regulatory: {
            actions,
            observations,
            occurrences,
            families: byEvidenceFamily.map((f) => ({ key: f.key, rows: f.rows })),
          },
          permits,
          liveStatus: snap.licensingStatus.liveCohort,
          graphStatus: snap.licensingStatus.graph,
          tradeFamilies: tradeFamilies.map((t) => ({
            id: t.id,
            n: t.credentialRows,
            ac: t.activeCurrentRows,
            sources: t.contributingSources,
          })),
        },
        null,
        2
      )
    );
  } catch (err) {
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
