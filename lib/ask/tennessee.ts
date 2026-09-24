import { phraseInText } from "./ontology";
import summary from "@/lib/tennessee-intelligence/summary.json";
import { TN_COMPLAINT, TN_QA_DASHBOARD, TN_VERIFY } from "@/lib/tennessee-intelligence/publication";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// TN-CON-001. Counts only (summary.json); license rows and discipline rows stay on /tennessee.
// Contractor, Home Improvement, LLE, and LLP are separate credentials. No combined contractor count.

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Tennessee",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Tennessee Board for Licensing Contractors",
  entityType: "Tennessee contractor credential",
  sort: "Default",
  notes: [],
};

const n = (v: number) => v.toLocaleString("en-US");
type TnCity = keyof typeof summary.cityOfLicenseeAddress;
const CITY_COUNTY: Record<TnCity, string> = { Nashville: "Davidson", Memphis: "Shelby", Knoxville: "Knox", Chattanooga: "Hamilton" };

function result(query: string, interpretation: AskInterpretation, extra: Partial<AskResult>): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/tennessee",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: [],
    ...extra,
  };
}

function city(text: string): TnCity | null {
  const m = text.match(/\b(nashville|memphis|knoxville|chattanooga)\b/);
  return m ? ((m[1][0].toUpperCase() + m[1].slice(1)) as TnCity) : null;
}

export function hasTennesseeIntent(text: string): boolean {
  return phraseInText(text, "tennessee") || /(^|\s)in tn(?=\s|$)/.test(text) || city(text) !== null;
}

export function interpretTennessee(query: string, text: string): AskResult | null {
  if (!hasTennesseeIntent(text)) return null;
  const interpretation: AskInterpretation = { ...EMPTY, notes: ["tn-con-001-state-intelligence"] };
  const place = city(text);

  // Exact Contractor license number first.
  const lic = query.match(/\b(?:license|lic\.?|#|no\.?|number)\s*#?\s*(\d{3,7})\b/i)?.[1];
  if (lic && !/\b(lle|llp|home improvement|hic)\b/.test(text)) {
    const href = `/tennessee?license=${lic}#license-lookup`;
    return result(query, { ...interpretation, identifier: `TN-BLC:${lic}`, evidenceFamily: "Tennessee Contractor license number" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: `Tennessee Contractor license ${lic}`,
        body: "Open the exact license-number match in the Board's Contractor & Qualifying Agent export on the Tennessee page: status as published, expiration, classifications, and monetary limit. No match there does not mean unlicensed; Home Improvement, LLE, and LLP licenses are not in that file. Confirm current status on the state search.",
        href,
      },
      changeHints: ["Exact license number only; no name matching."],
    });
  }

  if (/\b(disciplin|enforcement|unlicensed|civil penalt|fine|fined|revok|revocation|suspend|violation)/.test(text)) {
    const href = "/tennessee#discipline";
    return result(query, { ...interpretation, evidenceFamily: "Tennessee Board discipline" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: "Tennessee Board for Licensing Contractors discipline (separate from licenses)",
        body: `Disciplinary Action Reports, ${summary.disciplineWindow}: ${n(summary.disciplineRows)} rows for the Board's program covering Contractors, Home Improvement, LLE, and LLP together; ${n(summary.unlicensedActivityRows)} are unlicensed activity, mostly by people or businesses with no license. No row prints a license number, so none is attached to a contractor record. Respondents are listed on the Tennessee page.`,
        href,
      },
      changeHints: ["Discipline rows are not added to license counts."],
    });
  }
  if (/\bcomplaint/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Tennessee contractor complaints" }, {
      href: TN_COMPLAINT,
      failMessage:
        "The Tennessee Board for Licensing Contractors takes complaints about unlicensed activity, unfair or deceptive practices, and other violations. Complaint records are not published, so this hub has none; only actions the Board takes appear in its Disciplinary Action Reports. A complaint is not discipline.",
      changeHints: ["Ask for Tennessee contractor discipline instead."],
    });
  }
  if (/\bqualifying agent|\bqa\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Tennessee qualifying agents" }, {
      href: TN_QA_DASHBOARD,
      failMessage: `A qualifying agent is the person who qualifies a Tennessee Contractor license. The Board's dashboard lists ${n(summary.qualifyingAgentRelationships)} license-to-agent links across ${n(summary.distinctLicenseNumbers)} Contractor license numbers. Agents are people, not contractor businesses, and are not counted as contractors. This hub does not republish their names; use the state dashboard.`,
      changeHints: ["Enter a Contractor license number to see how many agents it lists."],
    });
  }
  if (/\b(lle|limited licensed electrician|electrician|electrical)\b/.test(text)) {
    return result(query, { ...interpretation, trade: "electrical", evidenceFamily: "Tennessee LLE / electrical" }, {
      href: "/tennessee#lle",
      failMessage:
        "Tennessee electricians can need different credentials. A Limited Licensed Electrician (LLE) license is required only where a municipality uses the state Division of Fire Prevention for permits or inspections, for work under $25,000; many cities license electricians themselves. Electrical contracting at $25,000 or more needs a Contractor license with an electrical classification. No LLE list was acquired, so there is no LLE count here. Verify on the state search.",
      changeHints: ["LLE is not a Contractor license."],
    });
  }
  if (/\b(llp|limited licensed plumber|plumber|plumbing)\b/.test(text)) {
    return result(query, { ...interpretation, trade: "plumbing", evidenceFamily: "Tennessee LLP / plumbing" }, {
      href: "/tennessee#llp",
      failMessage:
        "A Tennessee Limited Licensed Plumber (LLP) license is required only where a municipality uses the state Division of Fire Prevention for permits or inspections, for work under $25,000 (general maintenance under $500 is exempt). Many cities license plumbers themselves. Plumbing contracting at $25,000 or more needs a Contractor license with a plumbing classification. No LLP list was acquired, so there is no LLP count here.",
      changeHints: ["LLP is not a Contractor license."],
    });
  }
  if (/\b(home improvement|hic|remodel)/.test(text)) {
    const county = place ? CITY_COUNTY[place] : null;
    const local = county
      ? ` ${place} is in ${county} County, one of the nine, but the county rule is about where the work is, not where a contractor is based.`
      : "";
    return result(query, { ...interpretation, evidenceFamily: "Tennessee Home Improvement license" }, {
      href: "/tennessee#home-improvement",
      failMessage: `A Tennessee Home Improvement license is required for residential remodeling from $3,000 to $24,999, only in the counties that adopted the law: Bradley, Davidson, Hamilton, Haywood, Knox, Marion, Robertson, Rutherford, and Shelby.${local} It is separate from the Contractor license. No Home Improvement list was acquired, so there is no count here. Verify on the state search.`,
      changeHints: ["Home Improvement licenses are not added to Contractor licenses."],
    });
  }
  if (place && !/\b(license|licensed)\b/.test(text)) {
    return result(query, { ...interpretation, location: place }, {
      href: "/tennessee",
      failMessage: `Tennessee contractor licenses are statewide. ${n(summary.cityOfLicenseeAddress[place])} Contractor licensees list a ${place} address in the state dashboard; an address is not a service area and not a count of contractors working there. ${place} may also have its own local licensing, which is not covered here. There is no separate ${place} page.`,
      changeHints: ["Enter a Contractor license number, or ask about Home Improvement licensing."],
    });
  }
  return result(query, { ...interpretation, evidenceFamily: "Tennessee Contractor license" }, {
    href: TN_VERIFY,
    failMessage: `A Tennessee Contractor license is required for projects of $25,000 or more when acting as a prime contractor, certain subcontractor, or construction manager. The Board's dashboard lists ${n(summary.distinctLicenseNumbers)} Contractor license numbers (${n(summary.activeLicenses)} Active as published), each with classifications and a monetary limit. That is not a count of all Tennessee contractors: Home Improvement, LLE, and LLP licenses are separate, and smaller jobs can still need one. See /tennessee.`,
    changeHints: ["Enter a license number, or ask about Home Improvement, LLE, or LLP."],
  });
}
