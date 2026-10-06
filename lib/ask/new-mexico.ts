import { nmCount, NM_SNAPSHOT as data, sumLineCounts } from "@/lib/new-mexico-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// Bare "nm" is not a match. "in nm" is.
const STATE = /\bnew mexico\b|\bin nm\b/i;
const OTHER = /\b(?:arkansas|oklahoma|arizona|texas|colorado|utah|missouri)\b|\bin (?:ar|ok|az|tx|co|ut|mo)\b/i;
const CITY = /\b(?:albuquerque|santa fe)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  if (!STATE.test(query)) return false;
  if (OTHER.test(query) && !/\bnew mexico\b/i.test(query)) return false;
  return true;
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "New Mexico",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "CID licensee lines on two clocks. Not a named roster.",
    entityType: "CID licensee line",
    sort: "Default",
    notes,
  };
}

function result(
  query: string,
  mode: "guidance" | "fail_closed",
  href: string,
  message: string,
  notes: string[],
): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode,
    supported: mode === "guidance",
    interpretation: base(notes),
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: mode === "fail_closed" ? message : null,
    changeHints: ["Open /new-mexico for the Construction Industries Division licensee lines."],
    definition: { title: "New Mexico Construction Industries Division", body: message, href },
  };
}

function geography(query: string): string {
  return CITY.test(query) ? " Albuquerque and Santa Fe are geography only." : "";
}

function n(value: number): string {
  return value.toLocaleString("en-US");
}

function howManyMessage(): string {
  const lines = data.current.lines;
  const listed = lines.map((line) => `${line.label} ${n(line.count)}`).join("; ");
  const business = nmCount(lines, "companies") + nmCount(lines, "lp");
  const certificates =
    nmCount(lines, "qualifying-parties") + nmCount(lines, "qualifying-parties-lp") + nmCount(lines, "journeyman");
  const earlierSum = sumLineCounts(data.earlier.lines);
  return [
    "There is no single combined New Mexico contractor total.",
    `On the current printed table the lines are separate: ${listed}.`,
    `Licensee companies plus licensee LP is ${n(business)}, the prose figure of roughly ${n(data.current.proseContractingBusinessesRoughly)} contracting businesses.`,
    `Qualifying parties, qualifying parties LP, and journeyman licenses sum to ${n(certificates)}, the prose figure of ${n(data.current.proseCertificateHolders)} certificate holders.`,
    "Those two prose groups are not added into a new total.",
    `The six lines sum to the printed total ${n(data.current.printedTotal)}. That printed total is not a contractor-company count.`,
    `The earlier document, run ${data.earlier.runDate}, is not this table. Its six lines sum to ${n(earlierSum)}, which is not its printed total of ${n(data.earlier.printedTotal)}.`,
    "Manufactured housing is not included.",
  ].join(" ");
}

export function interpretNewMexico(query: string): AskResult | null {
  if (!matches(query)) return null;
  if (RANK.test(query)) {
    return result(
      query,
      "fail_closed",
      "/new-mexico",
      "ContractorTrustHub does not rank New Mexico contractors and does not publish a Trust Score.",
      ["Ranking is unsupported."],
    );
  }
  const place = geography(query);
  if (/\bmanufactured housing\b|\bmhd\b/i.test(query)) {
    const current = data.manufacturedHousing.current;
    const earlier = data.manufacturedHousing.earlier;
    return result(
      query,
      "guidance",
      "/new-mexico#manufactured-housing",
      `Manufactured housing is not CID. On the current plan the narrative says ${n(current.narrativeActiveContractors)} active contractors and ${n(current.narrativeSalespersons)} salespersons. The table total is ${n(current.tableTotal)}: Crossover ${n(nmCount(current.lines, "crossover"))}, Dealers ${n(nmCount(current.lines, "dealers"))}, Installers ${n(nmCount(current.lines, "installers"))}, Manufacturers ${n(nmCount(current.lines, "manufacturers"))}, and Salespersons ${n(nmCount(current.lines, "salespersons"))}. The narrative active-contractor figure matches the crossover line, not the table total. Do not add manufactured housing into CID. The earlier document is a separate clock: narrative ${n(earlier.narrativeActiveContractors)} active contractors and table total ${n(earlier.tableTotal)}.${place}`,
      ["Manufactured housing stays off the CID table."],
    );
  }
  if (/\belevator\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/new-mexico#current",
      `The elevator bureau was established in ${data.current.elevatorBureauEstablished} and is one of five trade bureaus on the current plan. Its licensee count is ${data.current.elevatorLicenseeCount}. The earlier budget form has ${data.earlier.bureauCount} bureaus and no elevator bureau.${place}`,
      ["No acquired elevator licensee count."],
    );
  }
  if (/\bqualifying part(?:y|ies)\b|\bqp\b/i.test(query)) {
    const lines = data.current.lines;
    return result(
      query,
      "guidance",
      "/new-mexico#current",
      `A qualifying party is not the company. On the current printed table, Qualifying Parties are ${n(nmCount(lines, "qualifying-parties"))} and Qualifying Parties LP are ${n(nmCount(lines, "qualifying-parties-lp"))}. Licensee - Companies are ${n(nmCount(lines, "companies"))} and Licensee - LP are ${n(nmCount(lines, "lp"))}.${place}`,
      ["Qualifying party is not the company."],
    );
  }
  if (/\bjourneymen\b|\bjourneyman\b/i.test(query)) {
    return result(
      query,
      "guidance",
      "/new-mexico#current",
      `A journeyman license is not the company. On the current printed table, Journeyman Licenses are ${n(nmCount(data.current.lines, "journeyman"))}. That line is a certificate-holder line, not a contracting business.${place}`,
      ["Journeyman is not the company."],
    );
  }
  if (/\b(?:bond|bonded|insurance|insured|liability)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/new-mexico#limits",
      `Observed bond or insurance coverage is ${data.observedBondOrInsurance}. These two documents did not give a bond minimum to publish.${place}`,
      ["No bond minimum is published from these PDFs."],
    );
  }
  if (/\b(?:enforcement|complaint|complaints|discipline|violation)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/new-mexico#limits",
      `The enforcement corpus is ${data.enforcementCorpus}. ${data.complaintIsNotAFinding}${place}`,
      ["A complaint is not a finding."],
    );
  }
  if (/\bcrane\b/i.test(query)) {
    return result(
      query,
      "guidance",
      "/new-mexico#earlier",
      `The earlier document says the Crane Operators Safety Program oversees ${n(data.earlier.craneOperators)} licensed crane operators. That is not a CID contractor class. It is not part of the current printed table.${place}`,
      ["Crane operators are not a CID class."],
    );
  }
  if (/\bsecondhand\b|\brecycled metal|\bmetal dealers?\b/i.test(query)) {
    return result(
      query,
      "guidance",
      "/new-mexico#current",
      `Secondhand Metal Dealers are ${n(nmCount(data.current.lines, "secondhand-metal"))} on the current printed table. They are inside that printed total and outside the contracting-business and certificate-holder prose groups. The earlier table says ${n(nmCount(data.earlier.lines, "secondhand-metal"))}. A highlight in the same earlier document says recycled metals oversees ${n(data.earlier.recycledMetalsDealersHighlight)} dealers. Both earlier figures are printed and are not forced equal.${place}`,
      ["Dealer figures stay as printed."],
    );
  }
  if (/\b(?:electrical|electrician|plumbing|plumber|hvac|mechanical|lp gas|classification)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/new-mexico#current",
      `The current plan names five trade bureaus and states ${data.current.statedClassifications} licensing classifications. Classification counts are ${data.current.classificationCounts}. They are not enumerated, and a bureau name is not a licensee count.${place}`,
      ["Classifications are not separated."],
    );
  }
  if (/\bpermits?\b|\binspections?\b/i.test(query)) {
    return result(
      query,
      "guidance",
      "/new-mexico#current",
      `Permits and inspections are activity, not licenses. On the current plan, CID permits issued are ${n(data.current.permitsIssued)} and inspections are ${n(data.current.inspections)}. On the earlier document, CID permits are ${n(data.earlier.permitsIssued)} and inspections are ${n(data.earlier.inspections)}. Manufactured housing activity is separate and is not added.${place}`,
      ["Activity is not a license count."],
    );
  }
  if (/\b(?:roster|bulk census|public search)\b|\bpsi\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/new-mexico#limits",
      `The named roster is ${data.namedRoster}. ${data.publicSearch}${place}`,
      ["Search is not a bulk census."],
    );
  }
  if (/\b(?:how many|number of|count of|census|total)\b/i.test(query)) {
    return result(query, "fail_closed", "/new-mexico#current", `${howManyMessage()}${place}`, [
      "No combined contractor total.",
    ]);
  }
  return result(
    query,
    "guidance",
    "/new-mexico",
    `Construction Industries Division licensee lines are printed on two clocks. The current table is the ${data.current.sourceTitle}. The earlier document is a budget form run ${data.earlier.runDate}, and it is not the current table. No combined contractor total is published. The named roster is ${data.namedRoster}.${place}`,
    ["The clocks stay separate."],
  );
}
