/**
 * ASK-SEARCH-CONTRACTOR-002 focused handoff assertions (no live DB).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasForbiddenHandoffKey,
  parseContractorAskHandoff,
  serializeContractorAskHandoff,
  withContractorAskParams,
} from "../lib/ask-handoff/parse";
import { resolveContractorHandoffGeography } from "../lib/ask-handoff/geography";
import { resolveContractorAskHandoff } from "../lib/ask-handoff/resolve";
import { FLORIDA_BROWSE_TRADE_SLUGS } from "../lib/network-discovery/florida-policy";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else console.log("PASS:", msg);
}

function safeHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("://");
}

const miami = parseContractorAskHandoff(
  "src=ask&entity=contractor&category=roofing&state=FL&county=miami-dade&city=miami"
);
assert(miami?.source === "ask", "parses src=ask");
assert(miami?.entityType === "contractor", "entity=contractor");
assert(miami?.category === "roofing", "category=roofing");
assert(miami?.state === "FL", "state=FL");
assert(miami?.county === "miami-dade", "county slug");
assert(miami?.city === "Miami", "city title-cased");
assert(parseContractorAskHandoff("state=FL&category=roofing") === null, "src=ask required");
assert(!serializeContractorAskHandoff(miami!).includes("query="), "query never serialized");
assert(hasForbiddenHandoffKey(new URLSearchParams("email=a@b.c&ssn=111")), "forbidden keys detected");

assert(parseContractorAskHandoff("src=ask&state=XX")?.state === undefined, "invalid state dropped");
assert(parseContractorAskHandoff("src=ask&zip=abc")?.zip === undefined, "invalid zip dropped");
const xss = parseContractorAskHandoff("src=ask&entity=%3Cscript%3E&city=../../etc");
assert(xss?.unsupportedEntity !== undefined, "script entity unsupported");
assert(!String(xss?.city || "").includes(".."), "city traversal stripped");
assert(
  parseContractorAskHandoff("src=ask&category=javascript:")?.unsupportedCategory,
  "javascript: category rejected"
);

assert(parseContractorAskHandoff("src=ask&category=roofers")?.category === "roofing", "roofers alias");
assert(parseContractorAskHandoff("src=ask&category=plumbing")?.category === "plumbing", "plumbing");
assert(parseContractorAskHandoff("src=ask&category=hvac")?.category === "hvac", "hvac");
assert(parseContractorAskHandoff("src=ask&category=pool")?.category === "pool", "pool");
assert(
  parseContractorAskHandoff("src=ask&category=general_contractor")?.category === "general_contractor",
  "general_contractor"
);
assert(
  parseContractorAskHandoff("src=ask&category=electrical")?.unsupportedCategory === "electrical",
  "electrical unsupported"
);
assert(
  parseContractorAskHandoff("src=ask&entity=home_inspector")?.unsupportedEntity === "home_inspector",
  "home_inspector entity unsupported"
);
assert(
  parseContractorAskHandoff("src=ask&category=solar")?.unsupportedCategory === "solar",
  "solar unsupported"
);
assert(
  parseContractorAskHandoff("src=ask&category=painting")?.unsupportedCategory === "painting",
  "painting unsupported"
);
assert(parseContractorAskHandoff("src=ask&entity=roofer")?.entityType === "contractor", "roofer → contractor");
assert(parseContractorAskHandoff("src=ask&entity=electrician")?.unsupportedEntity === "electrician", "electrician not widened");

const miamiGeo = resolveContractorHandoffGeography(miami!);
assert(miamiGeo?.countySlug === "miami-dade", "Miami → Miami-Dade");
assert(miamiGeo?.cityCoveredByCountyOnly === true, "city request lands on county browse");
assert(miamiGeo?.matchClass === "exact_physical_county", "not fabricated exact-city service graph");

const tampaGeo = resolveContractorHandoffGeography(
  parseContractorAskHandoff("src=ask&state=FL&city=tampa")!
);
assert(tampaGeo?.countySlug === "hillsborough", "Tampa → Hillsborough");
const orlandoGeo = resolveContractorHandoffGeography(
  parseContractorAskHandoff("src=ask&state=FL&city=orlando")!
);
assert(orlandoGeo?.countySlug === "orange", "Orlando → Orange");
assert(
  resolveContractorHandoffGeography(parseContractorAskHandoff("src=ask&state=FL&city=atlantis-prime")!) ===
    null,
  "unknown city fail closed"
);

const miamiDest = resolveContractorAskHandoff(miami!);
assert(miamiDest.path === "/florida/miami-dade/roofers", "Miami roofing → county/trade browse");
assert(miamiDest.status === "ok", "Miami roofing ok");
assert(/Miami-Dade County/i.test(miamiDest.bannerTitle), "county copy, not serves Miami");
assert(!/serves Miami/i.test(miamiDest.bannerBody), "no service-area claim");
assert(safeHref(miamiDest.href), "Miami href internal");
assert(miamiDest.backLabel.includes("Miami-Dade"), "back label county");

const broward = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&entity=contractor&category=roofing&state=FL&county=broward")!
);
assert(broward.path === "/florida/broward/roofers", "Broward roofing browse");

const palm = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=plumbing&state=FL&county=palm-beach")!
);
assert(palm.path === "/florida/palm-beach/plumbing", "Palm Beach plumbing browse");

const tampa = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=hvac&state=FL&city=tampa")!
);
assert(tampa.path === "/florida/hillsborough/air-conditioning", "Tampa HVAC → Hillsborough CAC page");
assert(tampa.path !== "/florida/hillsborough/mechanical", "no CMC widening");
assert(FLORIDA_BROWSE_TRADE_SLUGS.hvac === "air-conditioning", "HVAC slug is CAC page");

const orlando = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=general_contractor&state=FL&city=orlando")!
);
assert(orlando.path === "/florida/orange/general-contractors", "Orlando GC → Orange CGC page");
assert(!orlando.path.includes("building-contractors"), "no CBC widening");
assert(!orlando.path.includes("residential-contractors"), "no CRC widening");

const pool = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=pool&state=FL&county=miami-dade")!
);
assert(pool.path === "/florida/miami-dade/pool-spa", "pool uses existing pool-spa browse");

const elec = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=electrical&state=FL&city=jacksonville")!
);
assert(elec.status === "unsupported", "Jacksonville electricians fail closed");
assert(elec.path === "/from-ask/unsupported", "electrical not redirected to GC");
assert(!elec.href.includes("general-contractors"), "electrical not widened");

const inspectors = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&entity=home_inspector&state=FL&city=miami")!
);
assert(inspectors.status === "unsupported", "home inspectors fail closed");
assert(!inspectors.href.includes("general-contractors"), "inspectors not widened");

const solar = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=solar&state=FL&city=miami")!
);
assert(solar.status === "unsupported", "solar fail closed");

const paint = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=painting&state=FL&city=miami")!
);
assert(paint.status === "unsupported", "painters fail closed");

const njRoof = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=roofing&state=NJ&county=monmouth")!
);
assert(njRoof.status === "unsupported", "NJ roofing unsupported");
assert(!njRoof.path.startsWith("/florida"), "NJ roofing not Florida browse");
assert(!njRoof.path.includes("monmouth"), "no NJ county browse invented");

const njPlumb = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&category=plumbing&state=NJ&county=bergen")!
);
assert(njPlumb.status === "soft", "NJ plumbing SOFT");
assert(njPlumb.path === "/verify", "NJ plumbing uses Verify");
assert(/SOFT|Verify/i.test(njPlumb.bannerBody) || /no county/i.test(njPlumb.bannerBody), "NJ copy is honest");

const evil = resolveContractorAskHandoff(
  parseContractorAskHandoff("src=ask&state=FL&category=roofing&county=broward&next=https://evil.example")!
);
assert(safeHref(evil.href), "no open redirect");
assert(!evil.href.includes("evil"), "external host ignored");
assert(!withContractorAskParams("/florida/broward/roofers", miami!).includes("email="), "PII not in href");
assert(safeHref(withContractorAskParams("//evil.example", miami!)), "protocol-relative rejected");

const here = dirname(fileURLToPath(import.meta.url));
const profile = readFileSync(join(here, "../app/contractors/[slug]/page.tsx"), "utf8");
assert(profile.includes("AskProfileBackLink"), "profile has Ask back link");
assert(profile.includes("trustReportMetadata"), "profile canonical metadata unchanged helper");
assert(profile.includes('path = `/contractors/${encodeURIComponent(contractor.slug)}`'), "clean profile path");

const countyTrade = readFileSync(join(here, "../app/florida/[segment]/[facet]/page.tsx"), "utf8");
assert(countyTrade.includes("listFloridaBrowse"), "county/trade still uses existing browse");
assert(countyTrade.includes("AskSearchContextBanner"), "Ask banner additive on browse");

const robots = readFileSync(join(here, "../app/robots.ts"), "utf8");
assert(robots.includes("/from-ask"), "robots disallows /from-ask");

if (failed) {
  console.error(`ASK-SEARCH-CONTRACTOR-002 FAILED (${failed})`);
  process.exit(1);
}
console.log("ASK-SEARCH-CONTRACTOR-002 handoff assertions passed.");
