import { phraseInText } from "./ontology";
import { OHIO_SNAPSHOT } from "@/lib/ohio-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Not specified",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Not specified",
  entityType: "Contractor credential / identity",
  sort: "Default",
  notes: [],
};

function closed(
  query: string,
  interpretation: AskInterpretation,
  failMessage: string,
  changeHints: string[],
  extra?: Partial<AskResult>,
): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/ohio",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage,
    changeHints,
    ...extra,
  };
}

export function hasOhioIntent(text: string): boolean {
  const namedCity = /\b(columbus|cleveland|cincinnati|toledo|akron|dayton)\b/.test(text);
  return (
    phraseInText(text, "ohio") ||
    phraseInText(text, "ocilb") ||
    namedCity ||
    /(^|\s)in oh(?=\s|$)/.test(text)
  );
}

export function parseOhOcilbNumber(query: string, text: string): string | null {
  const dotted = query.match(/\b(EL|HV|HY|PL|RE)\.(\d{3,6})\b/i);
  if (dotted) {
    if (!hasOhioIntent(text) && !/\bocilb\b/i.test(query) && !/\b(EL|HV|HY|PL|RE)\./i.test(query)) return null;
    return `${dotted[1].toUpperCase()}.${dotted[2]}`;
  }
  const labeled = query.match(
    /\b(?:ocilb|electrical|hvac|hydronics|plumbing|refrigeration)\s*(?:contractor\s*)?(?:license(?:\s+number)?)?\s*#?\s*(?:(EL|HV|HY|PL|RE)\.?)?\s*(\d{3,6})\b/i,
  );
  if (!labeled?.[2]) return null;
  if (!hasOhioIntent(text) && !/\bocilb\b/i.test(query)) return null;
  if (labeled[1]) return `${labeled[1].toUpperCase()}.${labeled[2]}`;
  const fromTrade = /\belectrical\b/i.test(query)
    ? "EL"
    : /\bhydronics\b/i.test(query)
      ? "HY"
      : /\bhvac\b/i.test(query)
        ? "HV"
        : /\bplumbing\b/i.test(query)
          ? "PL"
          : /\brefrigeration\b/i.test(query)
            ? "RE"
            : null;
  if (!fromTrade) return null;
  return `${fromTrade}.${labeled[2]}`;
}

export function interpretOhioOcilb(query: string, text: string): AskResult | null {
  const license = parseOhOcilbNumber(query, text);
  const local = /\b(columbus|cleveland|cincinnati|toledo|akron|dayton)\b/.test(text);
  const oh = hasOhioIntent(text) || Boolean(license);
  if (!oh) return null;

  const interpretation: AskInterpretation = {
    ...EMPTY,
    location: "Ohio",
    identifier: license,
    notes: ["oh-ocilb-state-intelligence"],
  };
  const holders = OHIO_SNAPSHOT.ocilb.OH_OCILB_DISTINCT_LICENSE_HOLDERS;

  if (/\bbest\b|\bsafest\b|\btrust score\b|\brecommended\b/.test(text)) {
    return closed(
      query,
      interpretation,
      "ContractorTrustHub does not rank best or safest Ohio contractors and does not publish a Trust Score.",
      ["Use /ohio for official-source research"],
    );
  }
  if (license) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "OCILB license identity" },
      `${license} is an OCILB formatted credential. Exact credential outranks geography. The license holder is an individual; a company name on the roster is an association, not a separate company license. Confirm current status, including ACTIVE IN RENEWAL, on official OCILB lookup. ACTIVE IN RENEWAL is not expired.`,
      ["Open OCILB License Lookup"],
    );
  }
  if (local && /\b(contractor|ocilb|license)/.test(text)) {
    return closed(
      query,
      interpretation,
      "Ohio contractor intelligence on this hub is statewide only. Columbus, Cleveland, Cincinnati, Toledo, Akron, and Dayton are not local intelligence routes in this ticket. Local registration is not an OCILB license. Verify OCILB trades on eLicense and fire-protection work on the State Fire Marshal lookup.",
      ["Stay on /ohio"],
    );
  }
  if (/\bfire alarm designer|sprinkler designer|fire protection designer|special hazards/.test(text)) {
    return closed(
      query,
      interpretation,
      "Ohio Board of Building Standards fire-protection system designer certifications are not contractor licenses and not SFM installer certificates. Public designer lookup is not a bulk roster in this ticket (OPEN_SEARCH_ONLY, not zero). Designer ≠ installer ≠ OCILB contractor.",
      ["Read /ohio fire-protection section"],
    );
  }
  if (/\bfire alarm contractor|low-voltage fire|burglar alarm/.test(text)) {
    return closed(
      query,
      interpretation,
      "A fire-alarm contractor is not necessarily an OCILB electrical contractor. ORC 4740.13(D) excludes certain low-voltage fire-alarm, burglar-alarm, cabling, tele-data, sound, communication, and landscape lighting/irrigation work from OCILB electrical licensure. Absence of an EL. credential does not automatically prove that contractor is unlicensed — research the State Fire Marshal certification path.",
      ["Open SFM License Lookup"],
    );
  }
  if (/\bfire protection installer|fire protection company|fire sprinkler contractor|fire pump|standpipe/.test(text)) {
    return closed(
      query,
      interpretation,
      `Ohio State Fire Marshal fire-protection installer certification is separate from OCILB. Current no-fee listing: ${OHIO_SNAPSHOT.fire_protection.OH_FIRE_INSTALLER_DISTINCT_CERT_IDS} distinct individual certificate IDs and ${OHIO_SNAPSHOT.fire_protection.OH_FIRE_COMPANY_CERT_ROWS} company certificates. Individual ≠ company. Category rows are not unique installers.`,
      ["Open /ohio fire-protection section"],
    );
  }
  if (/\bunlicensed\b/.test(text)) {
    return closed(
      query,
      interpretation,
      "Ohio law allows the attorney general to seek an injunction against a person acting as a Chapter 4740 contractor without required licensure. No structured public injunction catalog was acquired (OPEN_SEARCH_ONLY, not zero). This is not a news-derived blacklist. Name-only attachment is unsafe.",
      ["Read /ohio unlicensed section"],
    );
  }
  if (/\bdisciplin|consent order|final order|complaint/.test(text)) {
    return closed(
      query,
      interpretation,
      "OCILB specialty sections may suspend, revoke, refuse, require additional CE, or fine. Statewide discipline coverage is OPEN_SEARCH_ONLY — not zero. A complaint is not discipline. A notice is not a final order. Additional CE is not a suspension.",
      ["Open /ohio discipline section"],
    );
  }
  if (/\belectrical|electrician/.test(text)) {
    return closed(
      query,
      interpretation,
      `OCILB electrical contractor credentials use prefix EL. Current listing: ${OHIO_SNAPSHOT.electrical.OH_OCILB_ELECTRICAL_DISTINCT_CREDENTIALS} distinct EL. credentials. That is not every Ohio electrician and not a low-voltage fire-alarm census. The license holder is an individual.`,
      ["Open OCILB License Lookup"],
    );
  }
  if (/\bhydronic/.test(text)) {
    return closed(
      query,
      interpretation,
      `OCILB hydronics credentials use prefix HY. Current listing: ${OHIO_SNAPSHOT.hydronics.OH_OCILB_HYDRONICS_DISTINCT_CREDENTIALS} distinct HY. credentials. Hydronics is not HVAC and not plumbing even when the same numeric identity also holds HV. or PL.`,
      ["Open OCILB License Lookup"],
    );
  }
  if (/\bhvac|heating|air condition/.test(text)) {
    return closed(
      query,
      interpretation,
      `OCILB HVAC credentials use prefix HV. Current listing: ${OHIO_SNAPSHOT.hvac.OH_OCILB_HVAC_DISTINCT_CREDENTIALS} distinct HV. credentials. HVAC is not hydronics or refrigeration. Keep trades distinct.`,
      ["Open OCILB License Lookup"],
    );
  }
  if (/\bplumb/.test(text)) {
    return closed(
      query,
      interpretation,
      `OCILB plumbing credentials use prefix PL. Current listing: ${OHIO_SNAPSHOT.plumbing.OH_OCILB_PLUMBING_DISTINCT_CREDENTIALS} distinct PL. credentials. Plumbing is not hydronics.`,
      ["Open OCILB License Lookup"],
    );
  }
  if (/\brefrigerat/.test(text)) {
    return closed(
      query,
      interpretation,
      `OCILB refrigeration credentials use prefix RE. Current listing: ${OHIO_SNAPSHOT.refrigeration.OH_OCILB_REFRIGERATION_DISTINCT_CREDENTIALS} distinct RE. credentials. Refrigeration is not HVAC.`,
      ["Open OCILB License Lookup"],
    );
  }
  if (/\bresidential contractor/.test(text)) {
    return closed(
      query,
      interpretation,
      "OCILB Chapter 4740 licensed construction projects exclude a residential building as defined under the building-code chapter. Do not answer residential contractors Ohio with every OCILB license. Local registration may apply. Statewide residential-contractor licensing is not this five-trade commercial specialty roster.",
      ["Read /ohio general/residential gap"],
    );
  }
  if (/\bgeneral contractor|licensed general/.test(text)) {
    return closed(
      query,
      interpretation,
      `Ohio does not have a universal statewide general-contractor license. OCILB licenses five commercial specialty trades. Current distinct OCILB numeric license identities: ${holders}. That number is not a statewide GC census and not unique contractors if trade credentials are summed.`,
      ["Use /ohio"],
    );
  }
  if (/\bcommercial contractor/.test(text)) {
    return closed(
      query,
      interpretation,
      `Ohio statewide contractor intelligence in this ticket is primarily OCILB commercial specialty-trade licensing (EL. HV. HY. PL. RE.). Current distinct numeric license identities: ${holders}. Building permits remain local or fragmented.`,
      ["Use /ohio"],
    );
  }
  if (/\blicensed contractor|contractors ohio|contractor license|contractor ohio/.test(text)) {
    return closed(
      query,
      interpretation,
      `Ohio does not have one universal statewide contractor license. OCILB current no-fee listing: ${holders} distinct numeric license identities across five commercial specialty trades. Do not add electrical+HVAC+hydronics+plumbing+refrigeration and call them unique contractors. Fire-protection work is a separate State Fire Marshal path. Local registration may also apply.`,
      ["Use /ohio and official OCILB lookup"],
    );
  }
  return closed(
    query,
    interpretation,
    "Ohio contractor research is on /ohio. OCILB licenses five commercial specialty trades for individuals. Search-only surfaces are not zero. No Trust Score.",
    ["Open /ohio"],
  );
}
