/**
 * AL-CON-001. Reconcile the Alabama Licensing Board for General Contractors
 * FullRosterReport into a public snapshot. Rows stay source-native.
 * Phone, fax, and street address are not republished.
 *
 * Without --check, reads ALBGC_CSV or the sprint data file and writes the artifacts.
 * With --check, recomputes the snapshot from the committed roster. If the source
 * CSV is present, it must match that roster.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const check = process.argv.includes("--check");
const csvPath =
  process.env.ALBGC_CSV ||
  "C:\\Users\\Michael.Savitsky\\alabama-sprint-data\\genconbd-full-roster.csv";
const outDir = join(root, "lib", "alabama-intelligence");

const OTHER_BOARDS = [
  {
    id: "hblb",
    name: "Home Builders Licensure Board",
    site: "https://hblb.alabama.gov/",
    search: "https://alhobv7prod.glsuite.us/GLSuiteWeb/Clients/ALHOB/Public/LicenseeSearch.aspx",
    retrievedAt: "2026-10-05",
    bulkRoster: "NOT_ACQUIRED",
    rows: null,
    grain: "The board site prints separate individual and corporate license instructions. Public verification is a search form.",
    note: "Separate from the ALBGC FullRosterReport. No bulk roster was downloaded.",
  },
  {
    id: "aecb",
    name: "Alabama Board of Electrical Contractors",
    site: "https://aecb.alabama.gov/",
    search: "https://alecb-search.kalmservices.net/",
    retrievedAt: "2026-10-05",
    bulkRoster: "NOT_ACQUIRED",
    rows: null,
    grain: "NOT_ACQUIRED",
    note: "The consumer page links a licensee search. No bulk roster was found. ALBGC specialty text that says ELECTRICAL is an ALBGC classification, not this board.",
  },
  {
    id: "hacr",
    name: "Alabama Board of Heating, Air Conditioning and Refrigeration Contractors",
    site: "https://hacr.alabama.gov/",
    search: "https://hacr.igovsolution.net/online/Lookups/Individual_Lookup.aspx",
    retrievedAt: "2026-10-05",
    bulkRoster: "NOT_ACQUIRED",
    rows: null,
    grain: "Public verification is an individual lookup form.",
    note: "ALBGC specialty text that says HVAC is an ALBGC classification, not this board.",
  },
  {
    id: "pgfb",
    name: "Alabama Plumbers and Gas Fitters Examining Board",
    site: "https://pgfb.alabama.gov/",
    search: "https://alpgfb.igovsolution.net/online/Lookups/Individual.aspx",
    businessSearch: "https://alpgfb.igovsolution.net/online/Lookups/Business.aspx",
    retrievedAt: "2026-10-05",
    bulkRoster: "NOT_ACQUIRED",
    rows: null,
    grain: "Individual lookup and business lookup are separate search forms. Neither roster was downloaded.",
    note: "ALBGC specialty text that says PLUMBING is an ALBGC classification, not this board.",
  },
];

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value;
}

export function fingerprintOf(snapshot) {
  const { fingerprint, generatedAt, ...rest } = snapshot;
  return createHash("sha256").update(JSON.stringify(sortValue(rest))).digest("hex");
}

function tally(rows, pick) {
  const counts = new Map();
  for (const row of rows) {
    const key = pick(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([value, count]) => ({ value, count }));
}

function publishedRow(cells) {
  return {
    license: cells[1].trim(),
    name: cells[0].trim(),
    city: cells[3].trim(),
    state: cells[4].trim(),
    zip: cells[5].trim(),
    bidLimit: cells[8].trim(),
    specialty: cells[9].trim(),
    expiration: cells[10].trim(),
    extension: cells[11].trim(),
  };
}

function reconcile(roster, source) {
  const licenses = new Set();
  let duplicateLicenses = 0;
  let emptyLicenses = 0;
  let explicitSubcontractorSpecialtyRows = 0;
  let inactiveSpecialtyRows = 0;
  let extensionDatePresent = 0;
  let expirationDatePresent = 0;
  let specNotS = 0;
  let sNotSpec = 0;
  const nameOnly = [];
  for (const row of roster) {
    if (!row.license) emptyLicenses++;
    else if (licenses.has(row.license)) duplicateLicenses++;
    else licenses.add(row.license);
    const sub = /SUBCONTRACTOR/i.test(row.specialty);
    const inactive = row.specialty === "INACTIVE";
    const sPrefix = row.license.startsWith("S-");
    const iaPrefix = row.license.startsWith("IA-");
    if (sub) explicitSubcontractorSpecialtyRows++;
    if (inactive) inactiveSpecialtyRows++;
    if (sub !== sPrefix) {
      if (sub) specNotS++;
      else sNotSpec++;
    }
    if (/SUBCONTRACTOR/i.test(row.name) && !sub) {
      nameOnly.push({ license: row.license, name: row.name, specialty: row.specialty });
    }
    if (row.extension) extensionDatePresent++;
    if (row.expiration) expirationDatePresent++;
    if (inactive && !iaPrefix) throw new Error(`INACTIVE specialty without IA- prefix: ${row.license}`);
    if (iaPrefix && !inactive) throw new Error(`IA- prefix without INACTIVE specialty: ${row.license}`);
  }
  const prefix = { s: 0, ia: 0, numeric: 0, other: 0 };
  for (const row of roster) {
    if (row.license.startsWith("S-")) prefix.s++;
    else if (row.license.startsWith("IA-")) prefix.ia++;
    else if (/^\d/.test(row.license)) prefix.numeric++;
    else prefix.other++;
  }
  const unclassifiedRows = roster.length - explicitSubcontractorSpecialtyRows;
  const otherSpecialtyRows = unclassifiedRows - inactiveSpecialtyRows;
  if (specNotS || sNotSpec || prefix.other || emptyLicenses || duplicateLicenses) {
    throw new Error(`ALBGC grain drift ${JSON.stringify({ specNotS, sNotSpec, prefix, emptyLicenses, duplicateLicenses })}`);
  }
  if (prefix.s !== explicitSubcontractorSpecialtyRows || prefix.ia !== inactiveSpecialtyRows || prefix.numeric !== otherSpecialtyRows) {
    throw new Error("License prefix and specialty buckets do not align");
  }
  const specialtyFrequency = tally(roster, (row) => row.specialty);
  const snapshot = {
    contract_name: "contractor-al-state-intel-v1",
    path: "/alabama",
    regulator: "Alabama Licensing Board for General Contractors",
    source: {
      name: "FullRosterReport",
      url: "https://licensesearch.alabama.gov/genconbd/FullRosterReport",
      portal: "https://licensesearch.alabama.gov/genconbd",
      retrievedAt: "2026-10-05",
      sourceAsOf: null,
      bytes: source.bytes,
      sha256: source.sha256,
      lineScanDataRows: source.lineScanDataRows,
      parsedRows: roster.length,
    },
    rows: roster.length,
    distinctLicenses: licenses.size,
    duplicateLicenses,
    emptyLicenses,
    explicitSubcontractorSpecialtyRows,
    inactiveSpecialtyRows,
    otherSpecialtyRows,
    unclassifiedRows,
    primeContractorLabel: "NOT_IN_SOURCE",
    businessPersonGrain: "NOT_LABELED",
    statusColumn: "NOT_IN_SOURCE",
    bidLimitIsLicenseClass: false,
    expirationIsNotStatus: true,
    expirationDatePresent,
    extensionDatePresent,
    mailingAddressStateIsNotLicensingState: true,
    addressIsNotServiceArea: true,
    specialtyDistinctStrings: specialtyFrequency.length,
    nameOnlySubcontractorText: nameOnly,
    prefixCounts: { "S-": prefix.s, "IA-": prefix.ia, numeric: prefix.numeric },
    bidLimits: tally(roster, (row) => row.bidLimit).map((row) => ({
      value: row.value === "" ? "" : row.value,
      count: row.count,
      label: row.value === "" ? "blank in source" : row.value,
    })),
    topSpecialtyStrings: specialtyFrequency.filter((row) => row.count >= 100).map((row) => ({
      specialty: row.value,
      count: row.count,
    })),
    mailingAddressStates: tally(roster, (row) => row.state || ""),
    columnsRepublished: ["Name", "License_Number", "City", "State", "Zip", "Bid_Limit", "Specialty", "Expiration_Date", "Extension_Date"],
    columnsNotRepublished: ["Address", "Phone_Number", "fax"],
    otherBoards: OTHER_BOARDS,
    existingMatches: 0,
    netNewCanonicalEntities: 0,
    unresolvedIdentities: roster.length,
    newProfiles: 0,
    profileAttachments: 0,
    graphWrites: 0,
    claimEligibilityBroadened: false,
    nameOnlyAdverseJoins: 0,
    countyOrLocalRoutes: 0,
    generatedAt: source.generatedAt,
    fingerprint: "",
  };
  snapshot.fingerprint = fingerprintOf(snapshot);
  return { snapshot, specialtyFrequency };
}

function sourceMeta(buffer) {
  const text = buffer.toString("utf8");
  const physical = text.replace(/^\uFEFF/, "").split(/\n/).filter((line) => line.trim().length > 0);
  return {
    text,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    lineScanDataRows: Math.max(0, physical.length - 1),
    generatedAt: new Date().toISOString(),
  };
}

function rosterFromCsv(text) {
  const table = parseCsv(text);
  const header = table[0].map((cell) => cell.trim());
  const expected = ["Name", "License_Number", "Address", "City", "State", "Zip", "Phone_Number", "fax", "Bid_Limit", "Specialty", "Expiration_Date", "Extension_Date"];
  if (header.join("|") !== expected.join("|")) throw new Error(`Unexpected ALBGC header: ${header.join("|")}`);
  return table.slice(1).map((cells) => {
    if (cells.length !== 12) throw new Error(`Row width ${cells.length} for ${cells[1]}`);
    return publishedRow(cells);
  });
}

mkdirSync(outDir, { recursive: true });
const rosterPath = join(outDir, "roster.json");
const snapshotPath = join(outDir, "accepted-snapshot.json");
const frequencyPath = join(outDir, "specialty-frequency.json");

let roster;
let source;
if (existsSync(csvPath)) {
  const raw = sourceMeta(readFileSync(csvPath));
  source = raw;
  if (check && existsSync(snapshotPath)) source.generatedAt = JSON.parse(readFileSync(snapshotPath, "utf8")).generatedAt;
  roster = rosterFromCsv(raw.text).sort((a, b) => a.license.localeCompare(b.license));
} else if (check) {
  roster = JSON.parse(readFileSync(rosterPath, "utf8"));
  const previous = JSON.parse(readFileSync(snapshotPath, "utf8"));
  source = {
    bytes: previous.source.bytes,
    sha256: previous.source.sha256,
    lineScanDataRows: previous.source.lineScanDataRows,
    generatedAt: previous.generatedAt,
  };
} else {
  throw new Error(`ALBGC CSV not found: ${csvPath}`);
}

const { snapshot, specialtyFrequency } = reconcile(roster, source);
const frequencyOut = specialtyFrequency.map((row) => ({ specialty: row.value, count: row.count }));
if (check) {
  const previous = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const previousRoster = readFileSync(rosterPath, "utf8");
  const nextRoster = JSON.stringify(roster);
  if (previousRoster !== nextRoster) throw new Error("ALBGC roster drift");
  if (JSON.stringify(previous) !== JSON.stringify(snapshot)) throw new Error("ALBGC snapshot drift");
  const previousFrequency = readFileSync(frequencyPath, "utf8");
  if (previousFrequency !== JSON.stringify(frequencyOut)) throw new Error("ALBGC specialty frequency drift");
} else {
  writeFileSync(rosterPath, JSON.stringify(roster));
  writeFileSync(frequencyPath, JSON.stringify(frequencyOut));
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
}

console.log(JSON.stringify({
  check,
  rows: snapshot.rows,
  distinctLicenses: snapshot.distinctLicenses,
  explicitSubcontractorSpecialtyRows: snapshot.explicitSubcontractorSpecialtyRows,
  inactiveSpecialtyRows: snapshot.inactiveSpecialtyRows,
  unclassifiedRows: snapshot.unclassifiedRows,
  lineScanDataRows: snapshot.source.lineScanDataRows,
  nameOnly: snapshot.nameOnlySubcontractorText.length,
  fingerprint: snapshot.fingerprint,
}, null, 2));
