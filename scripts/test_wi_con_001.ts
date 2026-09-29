import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { WI_SNAPSHOT } from "../lib/wisconsin-intelligence/snapshot";
import { interpretWisconsin } from "../lib/ask/wisconsin";
import { interpretAskQuery } from "../lib/ask/interpret";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

test("DSPS class totals preserve business and person grain", () => {
  assert.equal(WI_SNAPSHOT.sourceDate,"2026-09-22");
  assert.deepEqual(WI_SNAPSHOT.classes.filter(row => row.grain === "business").map(row => row.code),["DCFR","DCFRR","EC","HVACCONT"]);
  assert.deepEqual(WI_SNAPSHOT.classes.filter(row => row.grain === "person").map(row => row.code),["HVACQ","ME","JE","PM"]);
  assert.equal(WI_SNAPSHOT.qualifier.grain,"person");
  assert.equal(WI_SNAPSHOT.qualifier.count,null);
  assert.equal(WI_SNAPSHOT.credentialRows,0);
  assert.equal(WI_SNAPSHOT.exactDisciplinaryAttachments,0);
  assert.equal(WI_SNAPSHOT.nameOnlyAdverseJoins,0);
  assert.equal(WI_SNAPSHOT.newCanonicalCompanies,0);
  assert.equal(WI_SNAPSHOT.graphWrites,0);
  assert.equal(WI_SNAPSHOT.claimEligibilityChanges,0);
});

test("Wisconsin routing has state and city context without a city page", () => {
  for(const query of ["contractor Wisconsin","Wisconsin contractor license","dwelling contractor Wisconsin","dwelling contractor qualifier Wisconsin","electrician Wisconsin","electrical contractor Wisconsin","plumber Wisconsin","plumbing contractor Wisconsin","HVAC contractor Wisconsin","contractor discipline Wisconsin","DSPS contractor Wisconsin","contractor Milwaukee","contractor Madison","contractor Green Bay","contractor Kenosha"]){
    assert.match(interpretAskQuery(query,{} as Parameters<typeof interpretAskQuery>[1]).href,/^\/wisconsin/,query);
  }
  assert.equal(normalizedPublishedStatePath("/Wisconsin"),"/wisconsin");
  assert.equal(normalizedPublishedStatePath("/wisconsin/milwaukee"),null);
});

test("labeled credential only; bare number ambiguous; rankings fail closed", () => {
  const exact=interpretWisconsin("DSPS credential 1234 - DC Wisconsin contractor");
  assert.equal(exact?.interpretation.identifier,"1234 - DC");
  assert.match(exact?.href ?? "",/credential=/);
  assert.equal(interpretWisconsin("1234"),null);
  assert.equal(interpretAskQuery("1234",{} as Parameters<typeof interpretAskQuery>[1]).mode,"fail_closed");
  assert.equal(interpretWisconsin("1234 Wisconsin contractor")?.interpretation.identifier,null);
  for(const query of ["best Wisconsin contractor","safest Wisconsin contractor","recommended Wisconsin contractor","most trustworthy Wisconsin contractor","top-rated Wisconsin contractor","highest-rated Wisconsin contractor","#1 Wisconsin contractor","Trust Score Wisconsin contractor","AggregateRating Wisconsin contractor","ratingValue Wisconsin contractor","paid ranking Wisconsin contractor","sponsored ranking Wisconsin contractor"]){
    assert.equal(interpretAskQuery(query,{} as Parameters<typeof interpretAskQuery>[1]).mode,"fail_closed",query);
  }
});

test("Wisconsin publication declares evidence gaps and avoids rating schema", () => {
  const page=readFileSync(new URL("../app/wisconsin/page.tsx",import.meta.url),"utf8");
  const sitemap=readFileSync(new URL("../lib/seo/sitemap-data.ts",import.meta.url),"utf8");
  const askResults=readFileSync(new URL("../components/ask/AskResults.tsx",import.meta.url),"utf8");
  assert.match(page,/NOT_ACQUIRED/);
  assert.match(page,/not every order is formal discipline/);
  assert.match(page,/Dwelling Contractor Qualifier \(DCQ\) is a person credential/);
  assert.equal((sitemap.match(/path: "\/wisconsin"/g)??[]).length,1);
  assert.match(askResults,/wisconsinEvidenceGateway \? null : <GeographyNotice/);
  assert.match(askResults,/DSPS statewide credential-class totals; no provider-location search/);
  assert.doesNotMatch(page,/AggregateRating|ratingValue|Trust Score/);
});
