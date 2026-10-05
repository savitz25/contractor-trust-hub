import { MS_SNAPSHOT as data } from "@/lib/mississippi-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\bmississippi\b|\bmsboc\b|\bin ms\b/i;
const CITY = /\b(?:gulfport|biloxi)\b/i;
const TOPIC = /\b(?:contractor|licen[sc]e|msboc|residential|commercial|builder)\b/i;

const fmt = (n: number) => n.toLocaleString("en-US");

export function interpretMississippi(query: string): AskResult | null {
  const named = STATE.test(query) || (CITY.test(query) && TOPIC.test(query));
  if (!named) return null;
  if (/\b(?:missouri|south carolina|alabama|louisiana|tennessee)\b/i.test(query)) return null;
  const ranking = /\b(?:best|safest|recommend(?:ed)?|top[- ]?rated|highest[- ]?rated|most trustworthy|most trusted|trust score|aggregaterating|ratingvalue|number one)\b|#\s*1\b/i.test(query);
  const city = query.match(/\b(jackson|gulfport|biloxi)\b/i)?.[1];
  const interpretation: AskInterpretation = {
    identifier: null,
    entityQuery: null,
    location: "Mississippi",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "MSBOC saved consolidated export",
    entityType: "MSBOC license-list key",
    sort: "Default",
    notes: [
      "MS-CON-001 recounts the 2026-08-14 export already loaded as ms_sbc. It does not insert rows.",
      "Licensed, expired, unlicensed, revoked, and suspended stay separate. Commercial and residential stay separate.",
    ],
  };
  const population = `The Mississippi State Board of Contractors export saved ${data.fileDate} has ${fmt(data.listRows)} list rows and ${fmt(data.uniqueKeys)} unique keys. ${fmt(data.licensed)} of those keys print Licensed. ${fmt(data.licensedExpired)} print Licensed Expired, ${fmt(data.unlicensed)} print Unlicensed, ${fmt(data.unlicensedExpired)} print Unlicensed Expired, ${fmt(data.revoked)} print Revoked, and ${fmt(data.suspended)} print Suspended. Commercial and residential type labels are a separate split of the same keys. The file is not a live census, and the counts are not added together.`;
  const body = ranking
    ? "ContractorTrustHub does not rank Mississippi contractors and does not publish a Trust Score."
    : /\b(?:disciplin\w*|violation|enforcement|complaint)\b/i.test(query)
      ? `No MSBOC violations file was acquired. Revoked (${fmt(data.revoked)}) and suspended (${fmt(data.suspended)}) are printed statuses on the license list, not a violations corpus. A complaint is not a finding.`
      : /\bqualif/i.test(query)
        ? "The qualifying party is not in this saved export. Missing is not zero qualifying parties."
        : /\b(?:expir\w*|issue date|county|class code)\b/i.test(query)
          ? "Expiration, issue date, county, and a classification catalog are not columns in this saved export. The public MSBOC search can show fields this file does not."
          : /\blicensed\b|\bactive\b/i.test(query)
            ? `${fmt(data.licensed)} unique keys print Licensed on the ${data.fileDate} file. That is the active status in this export. It is not a live census and it is not the ${fmt(data.uniqueKeys)} unique keys of every status.`
            : city
              ? `${city[0].toUpperCase()}${city.slice(1).toLowerCase()} is geography only. This research publishes no Mississippi city page. ${population}`
              : population;
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: ranking ? "fail_closed" : "guidance",
    supported: !ranking,
    interpretation,
    href: "/mississippi",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: ranking ? body : null,
    changeHints: ["Open /mississippi for the saved MSBOC export.", "Check a current license on the official MSBOC search."],
    definition: { title: "Mississippi State Board of Contractors", body, href: "/mississippi" },
  };
}
