import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { interpretNewMexico } from "../lib/ask/new-mexico";
import { nmCount, NM_SNAPSHOT as data, sumLineCounts } from "../lib/new-mexico-intelligence/snapshot";
import { pageMetadata } from "../lib/seo/page-meta";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";
import { absoluteUrl } from "../lib/site";
import { PUBLISHED_STATES } from "../lib/states/published-coverage";

test("New Mexico CID clocks stay on their own lines", () => {
  assert.equal(data.combinedContractorDenominator, null);
  assert.equal(data.namedRoster, "NOT_ACQUIRED");
  assert.equal(data.observedBondOrInsurance, "NOT_ACQUIRED");
  assert.equal(data.enforcementCorpus, "NOT_ACQUIRED");
  assert.equal(data.graphWrites, 0);
  assert.equal(data.newCanonicalEntities, 0);
  assert.equal(data.current.sha256, "f9c46a8c7933ebcda106de2059cddf6c40c76d8c7310d0ed4293f969d33242b1");
  assert.equal(data.current.bytes, 4412742);
  assert.equal(data.current.retrievedAt, "2026-10-06");
  assert.equal(data.current.filePathMonth, "December 2025");
  assert.equal(data.earlier.sha256, "8e6eae2985660db48102ab74273121de7d4a3b7706a76f3877241cf53addae66");
  assert.equal(data.earlier.bytes, 4283569);
  assert.equal(data.earlier.runDate, "Tuesday, September 3, 2024");
  assert.equal(data.earlier.role, "earlier-document");
  assert.equal(data.current.role, "current-printed-table");
  assert.deepEqual([...data.current.bureaus], [
    "Electrical",
    "Elevator",
    "General Construction",
    "LP Gas",
    "Mechanical Plumbing",
  ]);
  assert.equal(data.current.elevatorLicenseeCount, "NOT_ACQUIRED");
  assert.equal(data.current.classificationCounts, "NOT_SEPARATED");
  assert.equal(data.current.statedClassifications, 78);
  assert.equal(data.earlier.bureauCount, 4);
  assert.equal(data.earlier.includesElevator, false);

  assert.deepEqual(
    data.current.lines.map((row) => [row.id, row.count]),
    [
      ["qualifying-parties", 24854],
      ["qualifying-parties-lp", 2617],
      ["journeyman", 17024],
      ["companies", 16769],
      ["lp", 664],
      ["secondhand-metal", 58],
    ],
  );
  const business = nmCount(data.current.lines, "companies") + nmCount(data.current.lines, "lp");
  const certificates =
    nmCount(data.current.lines, "qualifying-parties") +
    nmCount(data.current.lines, "qualifying-parties-lp") +
    nmCount(data.current.lines, "journeyman");
  assert.equal(business, 17433);
  assert.equal(business, data.current.proseContractingBusinessesRoughly);
  assert.equal(certificates, 44495);
  assert.equal(certificates, data.current.proseCertificateHolders);
  assert.equal(sumLineCounts(data.current.lines), 61986);
  assert.equal(sumLineCounts(data.current.lines), data.current.printedTotal);
  assert.equal(business + certificates + nmCount(data.current.lines, "secondhand-metal"), data.current.printedTotal);
  const blendedProse = data.current.proseContractingBusinessesRoughly + data.current.proseCertificateHolders;
  assert.equal(blendedProse, 61928);
  assert.notEqual(blendedProse, data.current.printedTotal);
  assert.equal(data.current.lines.some((row) => row.count === data.current.permitsIssued), false);
  assert.equal(data.current.permitsIssued, 33377);
  assert.equal(data.current.inspections, 88016);

  assert.deepEqual(
    data.earlier.lines.map((row) => [row.id, row.count]),
    [
      ["qualifying-parties", 22702],
      ["qualifying-parties-lp", 2436],
      ["journeyman", 16132],
      ["companies", 15375],
      ["lp", 646],
      ["secondhand-metal", 62],
    ],
  );
  const earlierSum = sumLineCounts(data.earlier.lines);
  assert.equal(earlierSum, 57353);
  assert.equal(data.earlier.printedTotal, 59894);
  assert.notEqual(earlierSum, data.earlier.printedTotal);
  assert.equal(data.earlier.printedTotal - earlierSum, 2541);
  const earlierBusiness = nmCount(data.earlier.lines, "companies") + nmCount(data.earlier.lines, "lp");
  assert.equal(earlierBusiness, 16021);
  assert.equal(data.earlier.proseContractingBusinessesRoughly, 16055);
  assert.notEqual(earlierBusiness, data.earlier.proseContractingBusinessesRoughly);
  const earlierCertificates =
    nmCount(data.earlier.lines, "qualifying-parties") +
    nmCount(data.earlier.lines, "qualifying-parties-lp") +
    nmCount(data.earlier.lines, "journeyman");
  assert.notEqual(earlierCertificates, data.earlier.proseCertificateHoldersMoreThan);
  assert.equal(data.earlier.recycledMetalsDealersHighlight, 63);
  assert.equal(nmCount(data.earlier.lines, "secondhand-metal"), 62);
  assert.notEqual(data.earlier.recycledMetalsDealersHighlight, nmCount(data.earlier.lines, "secondhand-metal"));
  assert.equal(data.earlier.craneOperators, 360);
  assert.equal(data.earlier.lines.some((row) => /crane/i.test(row.label)), false);
  assert.equal(data.earlier.permitsIssued, 33872);
  assert.equal(data.earlier.inspections, 97076);

  const mhd = data.manufacturedHousing;
  assert.equal(mhd.separateFromCid, true);
  assert.equal(sumLineCounts(mhd.current.lines), 1880);
  assert.equal(sumLineCounts(mhd.current.lines), mhd.current.tableTotal);
  assert.equal(mhd.current.narrativeActiveContractors, 1447);
  assert.equal(mhd.current.narrativeActiveContractors, nmCount(mhd.current.lines, "crossover"));
  assert.notEqual(mhd.current.narrativeActiveContractors, mhd.current.tableTotal);
  assert.equal(mhd.current.narrativeSalespersons, nmCount(mhd.current.lines, "salespersons"));
  assert.deepEqual(
    mhd.current.lines.map((row) => [row.id, row.count]),
    [
      ["crossover", 1447],
      ["dealers", 96],
      ["installers", 122],
      ["manufacturers", 36],
      ["salespersons", 179],
    ],
  );
  assert.equal(mhd.current.permits, 7196);
  assert.equal(mhd.current.inspections, 9199);
  assert.equal(sumLineCounts(mhd.earlier.lines), 1949);
  assert.equal(mhd.earlier.narrativeActiveContractors, nmCount(mhd.earlier.lines, "crossover"));
  assert.notEqual(mhd.earlier.narrativeActiveContractors, mhd.earlier.tableTotal);
  assert.equal(mhd.earlier.narrativeSalespersons, 169);
  assert.deepEqual(
    mhd.earlier.lines.map((row) => [row.id, row.count]),
    [
      ["crossover", 1519],
      ["dealers", 90],
      ["installers", 141],
      ["manufacturers", 30],
      ["salespersons", 169],
    ],
  );
  assert.equal(mhd.earlier.permits, 6925);
  assert.equal(mhd.earlier.inspections, 8252);

  const snapshotSrc = readFileSync("lib/new-mexico-intelligence/snapshot.ts", "utf8");
  assert.doesNotMatch(snapshotSrc, /61928|61,928/);
});

test("New Mexico page publishes one statewide route", () => {
  const page = readFileSync("app/new-mexico/page.tsx", "utf8");
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  const meta = pageMetadata({
    title: "New Mexico contractor credential research",
    description: "New Mexico Construction Industries Division licensee lines.",
    path: "/new-mexico",
  });
  assert.match(page, /path: "\/new-mexico"/);
  assert.match(page, /pageMetadata/);
  assert.doesNotMatch(page, /noIndex/);
  assert.match(page, /not a contractor-company count/);
  assert.match(page, /Earlier document, not the current table/);
  assert.match(page, /This earlier document is not the current printed table/);
  assert.match(page, /namedRoster/);
  assert.match(page, /publicSearch/);
  assert.match(page, /complaintIsNotAFinding/);
  assert.match(page, /observedBondOrInsurance/);
  assert.match(page, /elevatorLicenseeCount/);
  assert.match(data.publicSearch, /not a bulk census/);
  assert.equal(data.complaintIsNotAFinding, "A complaint is not a finding.");
  assert.match(page, /activity, not licenses/);
  assert.match(page, /The residual /);
  assert.match(page, /unlabeled/);
  assert.match(page, /No class is\s+invented/);
  assert.match(page, /not forced equal/);
  assert.match(page, /Crane operators are not a CID contractor class/);
  assert.match(page, /Manufactured housing is not CID/);
  assert.match(page, /A qualifying party is not the company/);
  assert.match(page, /A journeyman license is not the company/);
  assert.match(page, /geography only/);
  assert.match(page, /Net-new entities/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|ratingValue/);
  assert.doesNotMatch(page, /\/new-mexico\/(?:albuquerque|santa-fe)/);
  assert.doesNotMatch(page, /61928|61,928/);
  assert.doesNotMatch(page, /\$\d/);
  assert.equal((sitemap.match(/path: "\/new-mexico"/g) || []).length, 1);
  assert.match(sitemap, /path: "\/arkansas"/);
  assert.equal(normalizedPublishedStatePath("/New-Mexico"), "/new-mexico");
  assert.equal(normalizedPublishedStatePath("/new-mexico"), null);
  assert.equal(normalizedPublishedStatePath("/new-mexico/albuquerque"), null);
  assert.equal(normalizedPublishedStatePath("/new-mexico/santa-fe"), null);
  assert.equal(absoluteUrl("/new-mexico"), "https://www.contractortrusthub.com/new-mexico");
  assert.equal((meta.alternates as { canonical?: string }).canonical, "https://www.contractortrusthub.com/new-mexico");
  assert.deepEqual(meta.robots, { index: true, follow: true });
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "new-mexico" && state.code === "NM"), true);
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "arkansas" && state.code === "AR"), true);
  const interpret = readFileSync("lib/ask/interpret.ts", "utf8");
  const request = readFileSync("lib/ask/request.ts", "utf8");
  assert.match(interpret, /interpretNewMexico/);
  assert.match(request, /\\bnew mexico\\b\|\\bin nm\\b/);
  assert.doesNotMatch(request, /\\bnm\\b/);
});

test("New Mexico ask does not invent one contractor census", () => {
  const howMany = interpretNewMexico("how many contractors in New Mexico");
  const howManyBody = howMany?.definition.body ?? "";
  assert.equal(howMany?.mode, "fail_closed");
  assert.equal(howMany?.count, null);
  assert.equal(howMany?.aggregate, null);
  assert.match(howManyBody, /no single combined New Mexico contractor total/);
  assert.match(howManyBody, /16,769/);
  assert.match(howManyBody, /664/);
  assert.match(howManyBody, /24,854/);
  assert.match(howManyBody, /2,617/);
  assert.match(howManyBody, /17,024/);
  assert.match(howManyBody, /58/);
  assert.match(howManyBody, /not a contractor-company count/);
  assert.match(howManyBody, /not added into a new total/);
  assert.match(howManyBody, /not this table/);
  assert.doesNotMatch(howManyBody, /61,986 contractors/);
  assert.doesNotMatch(howManyBody, /17,433\s*\+\s*44,495/);
  assert.doesNotMatch(howManyBody, /61,928|61928/);

  const inNm = interpretNewMexico("how many contractors in nm");
  assert.equal(inNm?.mode, "fail_closed");
  assert.match(inNm?.definition.body ?? "", /16,769/);
  assert.match(inNm?.definition.body ?? "", /not a contractor-company count/);

  assert.equal(interpretNewMexico("nm"), null);
  assert.equal(interpretNewMexico("NM"), null);
  assert.equal(interpretNewMexico("contractor nm"), null);
  assert.equal(interpretNewMexico("contractors NM"), null);
  assert.equal(interpretNewMexico("nm contractor"), null);
  assert.equal(interpretNewMexico("NM contractor license"), null);
  assert.equal(interpretNewMexico("nm in"), null);
  assert.equal(interpretNewMexico("new mexican contractors"), null);
  assert.equal(interpretNewMexico("contractor Albuquerque"), null);
  assert.equal(interpretNewMexico("Santa Fe electrician"), null);
  assert.equal(interpretNewMexico("contractor Arkansas"), null);
  assert.equal(interpretNewMexico("contractor in Oklahoma"), null);
  assert.equal(interpretNewMexico("how many contractors in Arizona"), null);
  assert.equal(interpretNewMexico("contractor in nm and Arkansas"), null);

  assert.match(interpretNewMexico("contractors in NM")?.definition.body ?? "", /two clocks/);
  assert.match(interpretNewMexico("best contractor in Albuquerque New Mexico")?.definition.body ?? "", /does not rank/);
  assert.match(interpretNewMexico("best contractor in Albuquerque New Mexico")?.definition.body ?? "", /Trust Score/);
  assert.equal(interpretNewMexico("best contractor in Albuquerque New Mexico")?.mode, "fail_closed");
  assert.match(interpretNewMexico("contractor Santa Fe New Mexico")?.definition.body ?? "", /geography only/);
  assert.match(interpretNewMexico("qualifying party in New Mexico")?.definition.body ?? "", /not the company/);
  assert.match(interpretNewMexico("qualifying party in New Mexico")?.definition.body ?? "", /24,854/);
  assert.match(interpretNewMexico("journeyman in New Mexico")?.definition.body ?? "", /not the company/);
  assert.match(interpretNewMexico("journeyman in New Mexico")?.definition.body ?? "", /17,024/);
  assert.match(interpretNewMexico("manufactured housing in New Mexico")?.definition.body ?? "", /not CID/);
  assert.match(interpretNewMexico("manufactured housing in New Mexico")?.definition.body ?? "", /1,447/);
  assert.match(interpretNewMexico("manufactured housing in New Mexico")?.definition.body ?? "", /1,880/);
  assert.match(interpretNewMexico("elevator bureau in New Mexico")?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(interpretNewMexico("electrical contractor in New Mexico")?.definition.body ?? "", /NOT_SEPARATED/);
  assert.match(interpretNewMexico("bond insurance New Mexico contractor")?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.doesNotMatch(interpretNewMexico("bond insurance New Mexico contractor")?.definition.body ?? "", /\$\d/);
  assert.match(interpretNewMexico("crane operators in New Mexico")?.definition.body ?? "", /360/);
  assert.match(interpretNewMexico("crane operators in New Mexico")?.definition.body ?? "", /not a CID contractor class/);
  assert.match(interpretNewMexico("complaint in New Mexico")?.definition.body ?? "", /not a finding/);
});
