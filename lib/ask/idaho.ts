import { ID_SNAPSHOT as data, idBoard } from "@/lib/idaho-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// Bare "id" is not a match. "in id" is.
const STATE = /\bidaho\b|\bin id\b/i;
const OTHER =
  /\b(?:kansas|iowa|nebraska|new mexico|utah|arkansas|oklahoma|missouri|washington|oregon|montana|wyoming|nevada)\b|\bin (?:ks|ia|ne|nm|ut|ar|ok|mo|wa|or|mt|wy|nv)\b/i;
const CITY = /\b(?:boise|idaho falls|meridian|nampa|pocatello|twin falls|coeur d'alene)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  if (!STATE.test(query)) return false;
  if (OTHER.test(query) && !/\bidaho\b/i.test(query)) return false;
  return true;
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "Idaho",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "Idaho Contractors Board FY 2025 registration line. Not a named roster.",
    entityType: "Contractor registration line",
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
    changeHints: ["Open /idaho for the Idaho Contractors Board registration line."],
    definition: { title: "Idaho Contractors Board", body: message, href },
  };
}

function geography(query: string): string {
  return CITY.test(query) ? " Boise and other Idaho cities are geography only. No city route was published." : "";
}

function n(value: number): string {
  return value.toLocaleString("en-US");
}

function howManyMessage(): string {
  const current = data.contractorsBoard.fy2025.totalNumberOfLicenses;
  const electrical = idBoard("electrical");
  const hvac = idBoard("hvac");
  const plumbing = idBoard("plumbing");
  const publicWorks = idBoard("public-works");
  const earlier = data.contractorsBoard.earlierTotals;
  return [
    "There is no combined Idaho contractor population.",
    `The Idaho Contractors Board FY 2025 column prints Total Number of Licenses ${n(current)}.`,
    "That report word is Licenses. The board's public program is contractor registration. The line is not relabeled into a professional trade-license census.",
    `Person and business inside that line are ${data.personVsBusiness}.`,
    `Electrical Board ${n(electrical.fy2025TotalNumberOfLicenses)}, HVAC Board ${n(hvac.fy2025TotalNumberOfLicenses)}, Plumbing Board ${n(plumbing.fy2025TotalNumberOfLicenses)}, and Public Works Contractors License Board ${n(publicWorks.fy2025TotalNumberOfLicenses)} are separate boards.`,
    "They are not added to the Contractors Board line or to each other.",
    `Division-wide Active Licensees on June 30 in the FY 2025 column is ${n(data.divisionWideActiveLicenseesJune30Fy2025)}. That is not a contractor count.`,
    `Earlier Contractors Board columns stay on their own years: FY 2022 ${n(earlier.fy2022)}, FY 2023 ${n(earlier.fy2023)}, FY 2024 ${n(earlier.fy2024)}.`,
    `FY 2025 complaints are ${n(data.contractorsBoard.fy2025.complaints)} and final disciplinary actions are ${n(data.contractorsBoard.fy2025.finalDisciplinaryActions)}.`,
    `${data.complaintIsNotAFinding} Those action counts are not added to ${n(current)}.`,
    `The named roster is ${data.namedRoster}.`,
  ].join(" ");
}

export function interpretIdaho(query: string): AskResult | null {
  if (!matches(query)) return null;
  const place = geography(query);
  if (RANK.test(query)) {
    return result(
      query,
      "fail_closed",
      "/idaho",
      "ContractorTrustHub does not rank Idaho contractors and does not publish a Trust Score.",
      ["Ranking is unsupported."],
    );
  }
  if (/\belectric(?:al|ian|ians)?\b/i.test(query)) {
    const board = idBoard("electrical");
    return result(
      query,
      "guidance",
      "/idaho#other-boards",
      `The Electrical Board is separate from contractor registration. Its FY 2025 Total Number of Licenses is ${n(board.fy2025TotalNumberOfLicenses)}. Complaints are ${n(board.complaints)} and final disciplinary actions are ${n(board.finalDisciplinaryActions)}. ${data.complaintIsNotAFinding} This board is not added to the Contractors Board line.${place}`,
      ["Electrical licensure stays separate."],
    );
  }
  if (/\bhvac\b/i.test(query)) {
    const board = idBoard("hvac");
    return result(
      query,
      "guidance",
      "/idaho#other-boards",
      `The HVAC Board is separate from contractor registration. Its FY 2025 Total Number of Licenses is ${n(board.fy2025TotalNumberOfLicenses)}. Complaints are ${n(board.complaints)} and final disciplinary actions are ${n(board.finalDisciplinaryActions)}. ${data.complaintIsNotAFinding} This board is not added to the Contractors Board line.${place}`,
      ["HVAC licensure stays separate."],
    );
  }
  if (/\bplumb(?:ing|er|ers)\b/i.test(query)) {
    const board = idBoard("plumbing");
    return result(
      query,
      "guidance",
      "/idaho#other-boards",
      `The Plumbing Board is separate from contractor registration. Its FY 2025 Total Number of Licenses is ${n(board.fy2025TotalNumberOfLicenses)}. Complaints are ${n(board.complaints)} and final disciplinary actions are ${n(board.finalDisciplinaryActions)}. ${data.complaintIsNotAFinding} This board is not added to the Contractors Board line.${place}`,
      ["Plumbing licensure stays separate."],
    );
  }
  if (/\bpublic works\b/i.test(query)) {
    const board = idBoard("public-works");
    return result(
      query,
      "guidance",
      "/idaho#other-boards",
      `The Public Works Contractors License Board is separate from Idaho Contractors Board registration. Its FY 2025 Total Number of Licenses is ${n(board.fy2025TotalNumberOfLicenses)}. Complaints are ${n(board.complaints)} and final disciplinary actions are ${n(board.finalDisciplinaryActions)}. The report name says License. It is not added to the Contractors Board line.${place}`,
      ["Public works stays separate."],
    );
  }
  if (/\b(?:255,?119|division-wide|all boards|every board)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/idaho#division",
      `Active Licensees on June 30 in the FY 2025 column is ${n(data.divisionWideActiveLicenseesJune30Fy2025)}. That is the division-wide row. It is not an Idaho contractor count.${place}`,
      ["The division-wide row is not contractors."],
    );
  }
  if (/\b(?:complaint|complaints|discipline|disciplinary|violation|denied)\b/i.test(query)) {
    const row = data.contractorsBoard.fy2025;
    return result(
      query,
      "fail_closed",
      "/idaho#contractors-board",
      `FY 2025 Contractors Board complaints are ${n(row.complaints)} and final disciplinary actions are ${n(row.finalDisciplinaryActions)}. New applicants denied licensure are ${n(row.newApplicantsDeniedLicensure)}. ${data.complaintIsNotAFinding} No complaint was joined to a name. These counts are not added to Total Number of Licenses ${n(row.totalNumberOfLicenses)}.${place}`,
      ["A complaint is not a finding."],
    );
  }
  if (/\b(?:roster|bulk census|public search|search for a registration)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/idaho#limits",
      `The named roster is ${data.namedRoster}. ${data.publicSearch}${place}`,
      ["Search is not a bulk census."],
    );
  }
  if (/\b(?:bond|bonded|insurance|insured)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/idaho#limits",
      `Observed bond or insurance coverage for Idaho contractor registration is NOT_ACQUIRED.${place}`,
      ["No bond or insurance census was acquired."],
    );
  }
  if (/\b(?:how many|number of|count of|census|total)\b/i.test(query)) {
    return result(query, "fail_closed", "/idaho#contractors-board", `${howManyMessage()}${place}`, [
      "No combined contractor population.",
    ]);
  }
  return result(
    query,
    "guidance",
    "/idaho",
    `Idaho contractor registration is administered by the Idaho Contractors Board. The FY 2025 report column prints Total Number of Licenses ${n(data.contractorsBoard.fy2025.totalNumberOfLicenses)}. The report word is Licenses. The public program is registration. Electrical, HVAC, plumbing, and public works are separate boards and are not added. The named roster is ${data.namedRoster}.${place}`,
    ["Registration stays distinct from the other boards."],
  );
}
