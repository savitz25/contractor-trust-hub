import { phraseInText } from "./ontology";
import summary from "@/lib/minnesota-intelligence/summary.json";
import { MN_COMPLAINT, MN_LOOKUP } from "@/lib/minnesota-intelligence/publication";
import { CONTRACTOR_STATE_NAMES } from "@/lib/search/state-names";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// MN-CON-001. Counts only (summary.json); credential rows and enforcement rows stay on /minnesota.
// Business credential != individual credential != bond != certification != registration != enforcement.
// No combined Minnesota contractor count.

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Minnesota",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Minnesota Department of Labor and Industry",
  entityType: "Minnesota DLI credential",
  sort: "Default",
  notes: [],
};

const n = (v: number) => v.toLocaleString("en-US");
type MnCity = "Minneapolis" | "St. Paul" | "Rochester" | "Duluth";
const CITY_COUNT: Record<MnCity, number> = summary.cityOfRecordMinnesota;
const CITY_COUNTY: Record<MnCity, string> = { Minneapolis: "Hennepin", "St. Paul": "Ramsey", Rochester: "Olmsted", Duluth: "St. Louis" };
const OTHER_STATE_NAMES = Object.keys(CONTRACTOR_STATE_NAMES).filter((s) => s !== "minnesota");

function result(query: string, interpretation: AskInterpretation, extra: Partial<AskResult>): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/minnesota",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: [],
    ...extra,
  };
}

function namesOtherState(text: string): boolean {
  return OTHER_STATE_NAMES.some((s) => phraseInText(text, s)) || /(^|\s)(ga|ny|wi|ia|nd|sd|tx|ca|fl|nj|pa|oh|nc|tn|nv|ma|wa|co|va|il|mi)(?=\s|$)/.test(text);
}

function namesMinnesota(text: string): boolean {
  return phraseInText(text, "minnesota") || /(^|\s)(in )?mn(?=\s|$)/.test(text);
}

function city(text: string): MnCity | null {
  if (/\bminneapolis\b/.test(text)) return "Minneapolis";
  if (/\b(st|saint) paul\b/.test(text)) return "St. Paul";
  if (/\bduluth\b/.test(text)) return "Duluth";
  if (/\brochester\b/.test(text)) return "Rochester";
  return null;
}

const CRED = /\b([a-z0-9]{2})-?(\d{6})\b/i;

export function hasMinnesotaIntent(text: string): boolean {
  if (namesMinnesota(text)) return true;
  if (namesOtherState(text)) return false;
  // "DLI" alone is Minnesota only with a DLI-form credential number (other states have a DLI too).
  if (/\bdli\b/.test(text) && CRED.test(text) && /[a-z]/.test(text.match(CRED)![1])) return true;
  const c = city(text);
  // Rochester is Minnesota only when Minnesota is named (Rochester, New York); Duluth unless another state is named.
  return c !== null && c !== "Rochester";
}

const ENFORCEMENT = /\b(enforcement|disciplin|consent order|cease and desist|revok|revocation|suspend|suspension|penalt|fine|fined|violation|sanction)/;

export function interpretMinnesota(query: string, text: string): AskResult | null {
  if (!hasMinnesotaIntent(text)) return null;
  const interpretation: AskInterpretation = { ...EMPTY, notes: ["mn-con-001-state-intelligence"] };
  const place = city(text);

  // Exact DLI credential number first: two-character prefix with a letter, plus six digits.
  const m = query.match(/\b([A-Za-z][A-Za-z0-9]|[0-9][A-Za-z])-?(\d{6})\b/);
  if (m) {
    const exact = (m[1] + m[2]).toUpperCase();
    const href = `/minnesota?credential=${exact}#credential-lookup`;
    return result(query, { ...interpretation, identifier: `MN-DLI:${exact}`, evidenceFamily: "Minnesota DLI credential number" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: `Minnesota DLI credential ${exact}`,
        body: "Open the exact credential-number match in DLI's statewide export on the Minnesota page: credential type, whether a business or an individual holds it, status as DLI prints it, issue and expiration dates, and residential contractor enforcement actions that print that exact number. Individual credentials show no name or address. No match does not mean unlicensed; confirm on DLI's lookup.",
        href,
      },
      changeHints: ["Exact credential number only; no name matching."],
    });
  }
  if (/\b(license|licence|registration|credential|number|#)\b/.test(text) && /\b\d{4,8}\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Minnesota DLI credential number" }, {
      href: MN_LOOKUP,
      failMessage:
        "Minnesota DLI credential numbers start with a two-character prefix that names the credential (BC residential building contractor, QB qualifying builder, EA electrical contractor, PC plumbing contractor, and so on), followed by six digits. A number without its prefix is ambiguous and is not guessed. Enter the full number, for example BC123456.",
      changeHints: ["Enter the full DLI credential number with its prefix."],
    });
  }

  if (ENFORCEMENT.test(text)) {
    const href = "/minnesota#enforcement";
    return result(query, { ...interpretation, evidenceFamily: "Minnesota DLI residential contractor enforcement" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: "Minnesota DLI residential building contractor enforcement actions (separate from credentials)",
        body: `DLI's residential building contractor enforcement lists, ${summary.enforcementWindow}: ${n(summary.enforcementRows)} actions (consent orders, cease and desist orders, administrative and licensing orders). ${n(summary.enforcementAttachedByExactCredential)} print a credential number that exactly matches the export and appear in that credential's lookup; the rest stay standalone. Nothing is matched by name. DLI notes that a consent order is not a finding of fact or admission of guilt.`,
        href,
      },
      changeHints: ["Enforcement actions are not added to credential counts."],
    });
  }
  if (/\bcomplaint/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Minnesota contractor complaints" }, {
      href: MN_COMPLAINT,
      failMessage:
        "DLI takes written complaints about residential contractors and unlicensed work. Complaint records are not published, so this hub has none. A complaint is not a finding; only enforcement actions DLI publishes appear on /minnesota.",
      changeHints: ["Ask for Minnesota contractor enforcement instead."],
    });
  }
  if (/\bstatus\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Minnesota DLI credential status" }, {
      href: "/minnesota#credentials",
      failMessage: `DLI prints a status on every credential in its nightly export and says only "Issued" is current and active; other statuses include Expired, Voluntary Termination, Revoked, Suspended, and "LICENSED" on some registrations. Status is shown exactly as printed, and an expiration date alone does not make a credential current. Enter a credential number on /minnesota, or confirm on DLI's lookup.`,
      changeHints: ["Enter a DLI credential number with its prefix."],
    });
  }
  if (/\b(bond|bonded)\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Minnesota DLI bonds" }, {
      href: "/minnesota#bonds",
      failMessage: `DLI's export lists bonds as their own credentials: ${n(summary.mechanicalContractorBond.rows)} mechanical contractor bond rows (${n(summary.mechanicalContractorBond.issued)} Issued), plus pipelaying, MPCA pipelaying, and sign contractor bonds. A bond is regulatory evidence of financial responsibility, not an identity, a contractor count, a quality score, or insurance.`,
      changeHints: ["Bonds are not added to license counts."],
    });
  }
  if (/\b(contractor registration|registered contractor|independent contractor)\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Minnesota Contractor Registration" }, {
      href: "/minnesota#bonds",
      failMessage: `Minnesota Contractor Registration is a registration for independent contractors in the building trades, not a license: ${n(summary.contractorRegistration.rows)} rows in DLI's export, ${n(summary.contractorRegistration.issued)} Issued.`,
      changeHints: ["Registrations are not added to license counts."],
    });
  }
  if (/\b(qualifying|qualifier|qualified)\b/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Minnesota qualifying persons" }, {
      href: "/minnesota#residential",
      failMessage: `A Minnesota residential contractor license is held by the business and needs a qualifying person who passed the exam. Qualifying builder, remodeler, and roofer registrations are held by individuals: ${n(summary.qualifyingBuilder.rows)} qualifying builder rows (${n(summary.qualifyingBuilder.issued)} Issued). They are not contractors, are not named here, and are never added to license counts.`,
      changeHints: ["Enter a credential number to see one registration."],
    });
  }
  const r = (x: { rows: number; issued: number }) => `${n(x.rows)} rows in DLI's export, ${n(x.issued)} with status Issued`;
  const trades: Array<[RegExp, string, string, string]> = [
    [/\b(remodeler|remodeling|remodel)\b/, "Residential remodeler", "/minnesota#residential", `A Residential Remodeler Contractor license is a separate business license from the residential building contractor and roofer licenses: ${r(summary.residentialRemodeler)}.`],
    [/\b(roof|roofer|roofing)/, "Residential roofer", "/minnesota#residential", `A Residential Roofer Contractor license is a separate business license: ${r(summary.residentialRoofer)}.`],
    [/\b(electrical contractor|electrical business|electrical company)\b/, "Electrical contractor", "/minnesota#electrical", `Class A Electrical Contractor licenses are held by businesses: ${r(summary.classAElectricalContractor)}. Electricians are licensed separately as individuals.`],
    [/\b(electrician|electricians|master electrician|journeyworker)\b/, "Electrician", "/minnesota#electrical", `Electricians are licensed as individuals: Class A Master Electrician ${r(summary.classAMasterElectrician)}; Journeyworker A Electrician ${r(summary.journeyworkerAElectrician)}. An electrician is not an electrical contractor business, and individual credentials resolve here by exact number only.`],
    [/\b(electric|electrical)\b/, "Electrical", "/minnesota#electrical", `Minnesota keeps electrical businesses and electricians apart. Class A Electrical Contractor (business): ${r(summary.classAElectricalContractor)}. Class A Master Electrician (individual): ${r(summary.classAMasterElectrician)}.`],
    [/\b(plumbing contractor|plumbing business|plumbing company)\b/, "Plumbing contractor", "/minnesota#plumbing", `Plumbing Contractor licenses are held by businesses: ${r(summary.plumbingContractor)}. Plumbers are licensed separately as individuals.`],
    [/\b(plumber|plumbers)\b/, "Plumber", "/minnesota#plumbing", `Plumbers are licensed as individuals: Master Plumber ${r(summary.masterPlumber)}; Journeyworker Plumber ${r(summary.journeyworkerPlumber)}. A plumber is not a plumbing contractor business.`],
    [/\b(plumb|plumbing)/, "Plumbing", "/minnesota#plumbing", `Minnesota keeps plumbing businesses and plumbers apart. Plumbing Contractor (business): ${r(summary.plumbingContractor)}. Master Plumber (individual): ${r(summary.masterPlumber)}.`],
    [/\b(residential building contractor|home builder|homebuilder|builder)\b/, "Residential building contractor", "/minnesota#residential", `A Residential Building Contractor license is held by the business: ${r(summary.residentialBuildingContractor)}. Remodeler and roofer licenses are separate, and the qualifying builder is a separate individual registration.`],
  ];
  for (const [re, trade, href, body] of trades) {
    if (re.test(text)) {
      return result(query, { ...interpretation, trade, evidenceFamily: "Minnesota DLI credential class" }, {
        href,
        failMessage: `${body} These are credential rows, not contractors: one business can hold several, and business credentials, individual credentials, bonds, and registrations are never added. See /minnesota.`,
        changeHints: ["Credential rows are not contractors."],
      });
    }
  }
  if (place && !/\b(license|licensed)\b/.test(text)) {
    return result(query, { ...interpretation, location: place }, {
      href: "/minnesota",
      failMessage: `Minnesota construction credentials are statewide. ${n(CITY_COUNT[place])} business credentials in DLI's export list a ${place} address of record (${CITY_COUNTY[place]} County); an address is not a service area and not a count of contractors working there. City and county permits are separate and are not covered. There is no separate ${place} page.`,
      changeHints: ["Enter a DLI credential number, or ask about residential, electrical, or plumbing credentials."],
    });
  }
  return result(query, { ...interpretation, evidenceFamily: "Minnesota DLI credentials" }, {
    href: "/minnesota",
    failMessage: `Minnesota's Department of Labor and Industry licenses construction statewide and publishes a nightly export of ${n(summary.exportRows)} credential numbers (${n(summary.businessRows)} business, ${n(summary.personRows)} individual). Residential Building Contractor licenses: ${r(summary.residentialBuildingContractor)}; remodeler and roofer licenses are separate. That is not a count of Minnesota contractors. See /minnesota.`,
    changeHints: ["Enter a credential number, or ask about residential, electrical, plumbing, bonds, or enforcement."],
  });
}
