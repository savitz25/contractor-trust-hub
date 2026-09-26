import { interpretRecovery } from "./recovery";
import type { AskUrlOverrides } from "./url";
export const ASK_QUERY_LIMIT = 180;
/** Full input is validated before any parser. No suffix truncation. */
export function readAskRequest(
  params: Record<string, string | string[] | undefined>,
) {
  const q = params.q;
  let error = Object.values(params).some(Array.isArray)
    ? "Use one value per search field."
    : typeof q === "string" &&
        (q.length > ASK_QUERY_LIMIT || /[\u0000-\u001f]/.test(q))
      ? "Use a question of at most 180 characters without control characters."
      : params.geoAction &&
          !["correct", "broaden"].includes(String(params.geoAction))
        ? "Choose a valid geography action."
        : params.page && !/^[1-9]\d{0,3}$/.test(String(params.page))
          ? "Choose a valid page number."
          : null;
  const enums:Record<string,string[]>={status:['-','active_current','expired','all'],evidence:['-','dbpr_discipline','unlicensed_activity','stop_work','recovery_fund'],sort:['name','credential','expiration','evidence_count','evidence_newest'],trade:['-','roofing','hvac','plumbing','electrical','mechanical','pool_spa','building','general','residential','solar','alarm','telecom','locksmith','hearth','home_improvement']};
  for(const [key,values]of Object.entries(enums))if(params[key]&&!values.includes(String(params[key])))error??=`Choose a valid ${key} filter.`;
  if(params.geoChoice&&!/^[a-z-]{2,60}$/.test(String(params.geoChoice)))error??='Choose a valid geographic refinement.';
  if(params.geoCorrection&&!/^[a-z-]{2,60}$/.test(String(params.geoCorrection)))error??="Choose a valid prior county correction.";
  const query = typeof q === "string" ? q.trim() : "";
  const overrides: AskUrlOverrides = {};
  for (const key of [
    "geo",
    "trade",
    "status",
    "evidence",
    "sort",
    "page",
    "geoAction",
    "geoChoice",
    "geoCorrection",
  ] as const)
    if (typeof params[key] === "string") overrides[key] = params[key];
  return { query, overrides, error };
}

/** Both public research routes use this canonical selection; typed state travels unchanged. */
export function researchRoute(
  query: string,
  discovery: import("../search/contractor-discovery").ContractorSearchPlan,
) {
  if (interpretRecovery(query)) return "/ask" as const;
  if (
    /\b(?:new york|illinois|oregon|pennsylvania|philadelphia|pittsburgh|hicpa|pa hic|north carolina|nclbgc|charlotte|raleigh|ohio|ocilb|columbus|cleveland|cincinnati|toledo|akron|dayton|NY|IL|NC|OH)\b/i.test(
      query,
    ) ||
    /\bPA\s*#?\s*\d{5,10}\b/.test(query) ||
    // MA-CON-001: statewide Massachusetts guidance lives in /ask, not provider discovery.
    /\b(?:massachusetts|boston|worcester|dcamm|construction supervisor|csl|hic)\b/i.test(query) ||
    // TN-CON-001: statewide Tennessee guidance lives in /ask.
    /\b(?:tennessee|nashville|memphis|knoxville|chattanooga)\b/i.test(query) ||
    // NV-CON-001: statewide Nevada guidance lives in /ask.
    /\b(?:nevada|nscb|las vegas|henderson|reno)\b/i.test(query) ||
    // MN-CON-001: statewide Minnesota guidance lives in /ask.
    /\b(?:minnesota|minneapolis|st\.? paul|saint paul|duluth)\b/i.test(query) ||
    /\b(?:EL|HV|HY|PL|RE)\.\d{3,6}\b/i.test(query) ||
    /\bcompar(?:e|ison)\b/i.test(query)
  )
    return "/ask" as const;
  if (discovery.mode === "discovery" && discovery.request.state !== "FL")
    return "/search" as const;
  return "/ask" as const;
}
