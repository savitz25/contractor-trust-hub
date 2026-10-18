import assert from "node:assert/strict";
import { test } from "node:test";
import { displayCounty, profileLocationLine } from "../lib/contractors/county-display";
import { FLORIDA_COUNTIES } from "../lib/discovery/counties";
import { storedFloridaCountyMatches } from "../lib/discovery/florida-county-sql";
import { buildFilterClause } from "../lib/discovery/queries";
import {
  classifyFloridaCountyCode,
  FLORIDA_DBPR_COUNTY_CODES,
} from "../lib/intelligence/florida-county-codes";
import table from "../lib/intelligence/florida-dbpr-county-codes.json";
import { askWhere } from "../lib/ask/execute";
import { resolvePlanLocation } from "../lib/plan/location";
import { contractorEntityShareModel } from "../lib/seo/share-card-model";
import { trustReportJsonLd } from "../lib/seo/trust-report-seo";
import type { ContractorDetail } from "../lib/contractors/types";
import type { ContractorResearchQuery } from "../lib/ask/plan";

test("typescript county table matches the shared JSON and covers 67 counties", () => {
  assert.equal(Object.keys(table.counties).length, 67);
  assert.deepEqual(FLORIDA_DBPR_COUNTY_CODES, table.counties);
  assert.equal(FLORIDA_DBPR_COUNTY_CODES["74"], "Volusia");
  assert.equal(FLORIDA_DBPR_COUNTY_CODES["15"], "Brevard");
  assert.equal(FLORIDA_DBPR_COUNTY_CODES["63"], "Polk");
  assert.equal(FLORIDA_DBPR_COUNTY_CODES["69"], "Seminole");
  assert.equal(FLORIDA_DBPR_COUNTY_CODES["23"], "Miami-Dade");
  assert.equal(classifyFloridaCountyCode("99")?.kind, "unknown");
  assert.equal(classifyFloridaCountyCode("752")?.kind, "out_of_state");
  assert.equal(classifyFloridaCountyCode("801")?.kind, "foreign");
  assert.equal(classifyFloridaCountyCode("074")?.name, "Volusia");
});

test("display resolver maps stored codes and leaves names and other states unchanged", () => {
  assert.equal(displayCounty("74", "FL"), "Volusia");
  assert.equal(displayCounty("15", "FL"), "Brevard");
  assert.equal(displayCounty("63", "FL"), "Polk");
  assert.equal(displayCounty("69", "FL"), "Seminole");
  assert.equal(displayCounty("23", "FL"), "Miami-Dade");
  assert.equal(displayCounty("Volusia", "FL"), "Volusia");
  assert.equal(displayCounty("St. Johns", "FL"), "St. Johns");
  assert.equal(displayCounty("99", "FL"), null);
  assert.equal(displayCounty("752", "FL"), null);
  assert.equal(displayCounty("74", "NJ"), "74");
  assert.equal(displayCounty("Bergen", "NJ"), "Bergen");
  assert.equal(profileLocationLine("Example City", "74", "FL"), "Example City · Volusia · FL");
  assert.equal(profileLocationLine("Example City", "99", "FL"), "Example City · FL");
});

test("profile share and SEO receive the county name", () => {
  const card = contractorEntityShareModel({
    name: "Example County Fix LLC",
    county: "74",
    state: "FL",
  });
  assert.equal(card.subtitle, "Volusia County, Florida");
  assert.equal(JSON.stringify(card).includes("74"), false);

  const detail = {
    id: "example",
    slug: "example-county-fix",
    displayName: "Example County Fix LLC",
    legalName: null,
    dbaName: null,
    primaryCity: "Example City",
    primaryCounty: "74",
    homeState: "FL",
    isThinProfile: false,
    licenses: [],
    entities: [],
    discipline: [],
  } as ContractorDetail;
  const jsonLd = JSON.stringify(trustReportJsonLd(detail, "/contractors/example-county-fix"));
  assert.match(jsonLd, /Volusia County/);
  assert.equal(jsonLd.includes('"74"'), false);
  assert.equal(jsonLd.includes("74"), false);
});

test("discovery and plan match a stored numeric code to the county name", () => {
  const volusia = FLORIDA_COUNTIES.find((county) => county.slug === "volusia");
  const polk = FLORIDA_COUNTIES.find((county) => county.slug === "polk");
  const hillsborough = FLORIDA_COUNTIES.find((county) => county.slug === "hillsborough");
  assert.ok(volusia && polk && hillsborough);
  assert.deepEqual(volusia.matchCodes, ["74"]);
  assert.deepEqual(polk.matchCodes, ["63"]);
  assert.equal(FLORIDA_COUNTIES.every((county) => (county.matchCodes ?? []).length > 0), true);

  assert.equal(storedFloridaCountyMatches(volusia, { primaryCounty: "74" }), true);
  assert.equal(storedFloridaCountyMatches(polk, { primaryCounty: "63" }), true);
  assert.equal(storedFloridaCountyMatches(volusia, { primaryCounty: "Volusia" }), true);
  assert.equal(storedFloridaCountyMatches(hillsborough, { primaryCounty: "74" }), false);
  assert.equal(storedFloridaCountyMatches(volusia, { primaryCounty: "63" }), false);

  const filtered = buildFilterClause({
    licenseSource: "fl_dbpr",
    stateCode: "FL",
    county: volusia,
  });
  assert.ok(filtered.params.includes("74"));
  assert.ok(filtered.params.includes("volusia"));
  assert.match(filtered.where, /c\.primary_county/);
  assert.equal(filtered.params.includes("63"), false);

  const planned = resolvePlanLocation({ county: "74" });
  assert.equal(planned.county, "Volusia");
  assert.deepEqual(planned.countyCodes, ["74"]);
  const named = resolvePlanLocation({ county: "Polk" });
  assert.equal(named.county, "Polk");
  assert.deepEqual(named.countyCodes, ["63"]);

  const ask = askWhere({
    trade: { occupationCodes: [] },
    credentialStatus: "all",
    geography: { countySlug: "volusia", city: null },
  } as ContractorResearchQuery);
  assert.ok(ask);
  assert.ok(ask.params.includes("74"));
  assert.ok(ask.params.includes("volusia"));
  assert.match(ask.where, /c\.primary_county/);
  assert.match(ask.where, /l\.county_name/);
  assert.equal(ask.params.includes("63"), false);
});
