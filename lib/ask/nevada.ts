import { phraseInText } from "./ontology";
import summary from "@/lib/nevada-intelligence/summary.json";
import { NV_COMPLAINTS, NV_LICENSE_SEARCH } from "@/lib/nevada-intelligence/publication";
import { CONTRACTOR_STATE_NAMES } from "@/lib/search/state-names";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// NV-CON-001. Counts only (summary.json); license rows and discipline rows stay on /nevada.
// Business license != classification != qualified individual != discipline. No combined contractor count.

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Nevada",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Nevada State Contractors Board",
  entityType: "Nevada contractor license",
  sort: "Default",
  notes: [],
};

const n = (v: number) => v.toLocaleString("en-US");
type NvCity = "Las Vegas" | "Henderson" | "Reno";
const CITY_COUNT: Record<NvCity, number> = {
  "Las Vegas": summary.cityOfLicenseeAddress["Las Vegas"],
  Henderson: summary.cityOfLicenseeAddress.Henderson,
  Reno: summary.cityOfLicenseeAddress.Reno,
};
const CITY_COUNTY: Record<NvCity, string> = { "Las Vegas": "Clark", Henderson: "Clark", Reno: "Washoe" };
const OTHER_STATE_NAMES = Object.keys(CONTRACTOR_STATE_NAMES).filter((s) => s !== "nevada");

function result(query: string, interpretation: AskInterpretation, extra: Partial<AskResult>): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/nevada",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: [],
    ...extra,
  };
}

function city(text: string): NvCity | null {
  const m = text.match(/\b(las vegas|henderson|reno)\b/);
  if (!m) return null;
  return m[1] === "las vegas" ? "Las Vegas" : ((m[1][0].toUpperCase() + m[1].slice(1)) as NvCity);
}

function namesOtherState(text: string): boolean {
  return OTHER_STATE_NAMES.some((s) => phraseInText(text, s)) || /(^|\s)(nm|nc|ky|tn|tx)(?=\s|$)/.test(text);
}

export function hasNevadaIntent(text: string): boolean {
  if (phraseInText(text, "nevada") || /(^|\s)(in )?nv(?=\s|$)/.test(text) || phraseInText(text, "nscb")) return true;
  // A city alone is Nevada context only when no other state is named ("Las Vegas NM", "Henderson Kentucky").
  return city(text) !== null && !namesOtherState(text);
}

const DISCIPLINE = /\b(disciplin|board action|citation|hearing|revok|revocation|suspend|suspension|fine|fined|penalt|violation|probation)/;
const UNLICENSED = /\bunlicensed\b/;

export function interpretNevada(query: string, text: string): AskResult | null {
  if (!hasNevadaIntent(text)) return null;
  const interpretation: AskInterpretation = { ...EMPTY, notes: ["nv-con-001-state-intelligence"] };
  const place = city(text);

  // Exact license number first. A bare number without a license keyword is never guessed.
  const lic = query.match(/\b(?:license|lic\.?|#|no\.?|number)\s*#?\s*(\d{5,7}[A-Za-z]?)\b/i)?.[1];
  if (lic) {
    const digits = lic.replace(/[A-Za-z]$/, "");
    const exact = digits.padStart(7, "0") + lic.slice(digits.length).toUpperCase();
    const href = `/nevada?license=${exact}#license-lookup`;
    return result(query, { ...interpretation, identifier: `NV-NSCB:${exact}`, evidenceFamily: "Nevada contractor license number" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: `Nevada contractor license ${exact}`,
        body: "Open the exact license-number match in the Board's active directory on the Nevada page: business name, status as published, expiration, classifications, monetary limit, any limitation, and Board actions printed with that exact number. No match there does not mean unlicensed: expired, suspended, and revoked licenses are not in the active directory. Confirm on the Board's license search.",
        href,
      },
      changeHints: ["Exact license number only; no name matching."],
    });
  }

  if (UNLICENSED.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Nevada unlicensed contracting" }, {
      href: NV_COMPLAINTS,
      failMessage:
        "Contracting without a license is a separate enforcement matter for the Nevada State Contractors Board, with its own complaint form. Unlicensed respondents are not licensed contractor records, and no unlicensed-contractor enforcement list was loaded, so there is no count here. The Board's disciplinary search on /nevada covers actions against licensees.",
      changeHints: ["Ask about Nevada contractor discipline, or file an unlicensed-contractor complaint with the Board."],
    });
  }
  if (DISCIPLINE.test(text)) {
    const href = "/nevada#discipline";
    const types = Object.entries(summary.disciplineActionTypes).map(([k, v]) => `${k} ${n(v)}`).join(", ");
    return result(query, { ...interpretation, evidenceFamily: "Nevada Board disciplinary and Board actions" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: "Nevada State Contractors Board disciplinary and Board actions (separate from licenses)",
        body: `The Board's public disciplinary search, ${summary.disciplineWindow}: ${n(summary.disciplineRows)} rows (${types}). ${n(summary.disciplineAttachedByExactLicense)} rows print a license number that exactly matches a license in the active directory and appear in that license's lookup; the rest stay standalone. Nothing is matched by name. Revoked and suspended licenses are not in the active directory; confirm on the Board's license search.`,
        href,
      },
      changeHints: ["Discipline rows are not added to license counts."],
    });
  }
  if (/\bcomplaint/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Nevada contractor complaints" }, {
      href: NV_COMPLAINTS,
      failMessage:
        "The Nevada State Contractors Board takes complaints against licensed contractors and, separately, against unlicensed contractors. Complaint records are not published, so this hub has none; only actions the Board takes appear in its disciplinary search. A complaint is not discipline.",
      changeHints: ["Ask for Nevada contractor discipline instead."],
    });
  }
  if (/\b(qualif|qualified individual|qualifying party|qualifier|principal)/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Nevada qualified individuals" }, {
      href: "/nevada#qualifying-party",
      failMessage:
        "A Nevada contractor license belongs to the business. It is qualified by a person — the qualified individual, who can be an owner, officer, member, manager, or employee — and that person is not the license holder. The Board's active directory does not print qualified individuals or principals, so no list was loaded and none is counted as a contractor. Search by principal or qualified individual on the Board's license search.",
      changeHints: ["Enter a Nevada license number to see the business, classifications, and monetary limit."],
    });
  }
  if (/\b(monetary limit|contract limit|limit)\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Nevada monetary limit" }, {
      href: "/nevada#monetary-limit",
      failMessage: `The Nevada State Contractors Board sets a monetary limit on every license: the largest single contract or project the licensee may take on. It is a regulatory limit tied to financial responsibility — not revenue, company size, quality, or a recommended budget. ${n(summary.unlimitedMonetaryLimit)} of ${n(summary.distinctLicenseNumbers)} active licenses print "Unlimited"; the rest print a dollar amount.`,
      changeHints: ["Enter a Nevada license number to see its monetary limit."],
    });
  }
  const trades: Array<[RegExp, string, string]> = [
    [/\bgeneral building\b/, "General Building (B)", `Class B — General Building covers structures using more than two unrelated building trades. ${n(summary.licensesByCode.B)} active licenses carry the plain B classification and ${n(summary.licensesByCode["B-2"])} carry B-2 Residential and Small Commercial; B-family licenses in total: ${n(summary.licensesCarryingFamily["General Building (B)"])}.`],
    [/\bgeneral engineering\b/, "General Engineering (A)", `Class A — General Engineering covers fixed works needing specialized engineering knowledge, such as highways, pipelines, and grading. ${n(summary.licensesByCode.A)} active licenses carry the plain A classification; A-family licenses in total: ${n(summary.licensesCarryingFamily["General Engineering (A)"])}. ${n(summary.licensesByCode.AB)} licenses hold AB (both).`],
    [/\b(roof|roofer|roofing)/, "Roofing", `Roofing is a Class C specialty: C-15 Roofing and Siding (${n(summary.licensesByCode["C-15"])} active licenses) and C-15A Roofing (${n(summary.licensesByCode["C-15A"])}).`],
    [/\b(electric|electrician|electrical)/, "Electrical", `Electrical contracting is the C-2 specialty with subclassifications; ${n(summary.licensesByCode["C-2"])} active licenses carry plain C-2 Electrical.`],
    [/\b(plumb|plumber|plumbing)/, "Plumbing", `Plumbing is the C-1 specialty (Plumbing and Heating) with subclassifications; ${n(summary.licensesByCode["C-1"])} active licenses carry plain C-1.`],
  ];
  for (const [re, trade, body] of trades) {
    if (re.test(text)) {
      return result(query, { ...interpretation, trade, evidenceFamily: "Nevada license classification" }, {
        href: "/nevada#classifications",
        failMessage: `${body} Counts are classification links in the Board's active directory, not contractors: one license can carry several classifications, and links are never added into a contractor total. Enter a license number on /nevada to see a license's exact classifications.`,
        changeHints: ["Classification links are not contractors."],
      });
    }
  }
  if (place && !/\b(license|licensed)\b/.test(text)) {
    return result(query, { ...interpretation, location: place }, {
      href: "/nevada",
      failMessage: `Nevada contractor licenses are statewide. ${n(CITY_COUNT[place])} active licenses list a ${place} address in the Board's directory (${CITY_COUNTY[place]} County); an address is not a service area and not a count of contractors working there. City and county business licenses and permits are separate and are not covered here. There is no separate ${place} page.`,
      changeHints: ["Enter a Nevada license number, or ask about classifications or monetary limits."],
    });
  }
  return result(query, { ...interpretation, evidenceFamily: "Nevada contractor license" }, {
    href: NV_LICENSE_SEARCH,
    failMessage: `Nevada contractors are licensed statewide by the Nevada State Contractors Board. The Board's active directory lists ${n(summary.distinctLicenseNumbers)} active license numbers, each held by a business, with one or more A / B / AB / C classifications and a monetary limit. That is not a count of Nevada contractors: one business can hold more than one license, and expired or inactive licenses are not in the directory. See /nevada.`,
    changeHints: ["Enter a license number, or ask about classifications, monetary limits, or qualified individuals."],
  });
}
