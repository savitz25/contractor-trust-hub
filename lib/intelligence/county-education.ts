import type { IntelligenceEducationModule } from "./education";

export const COUNTY_INTELLIGENCE_EDUCATION: IntelligenceEducationModule[] = [
  {
    id: "state-license-vs-local-permit",
    title: "Florida state license vs local permit authority",
    summary:
      "A DBPR / CILB credential is a statewide occupation license. A building permit is issued by a local authority having jurisdiction. A state license does not automatically prove a specific job was permitted. Ask who pulls the permit and confirm with the building department for that address.",
    href: "/guides/florida-contractor-license-types",
  },
  {
    id: "certified-vs-registered",
    title: "Certified vs registered contractors",
    summary:
      "Certified contractors are licensed by CILB and may work where that class is recognized, still subject to local permitting. Registered contractors operate under a more limited local-jurisdiction framework. Confirm the class on the DBPR record.",
    href: "/guides/florida-contractor-license-types",
  },
  {
    id: "why-permit-history",
    title: "Why permit history matters",
    summary:
      "Permit records, when loaded, are operating evidence: who pulled work, where, and in which AHJ. They are a separate layer from the state credential. Confirmed county-issued rows are not complete municipal history. Issued is not final.",
  },
  {
    id: "many-permitting-authorities",
    title: "Why one county can have many permitting authorities",
    summary:
      "Florida counties typically contain a county/unincorporated AHJ plus municipalities that issue their own building permits. Mapped jurisdictions tell us where local research must occur. Mapping is not permit coverage.",
  },
  {
    id: "address-not-operating",
    title: "County address is not operating geography",
    summary:
      "The county on a DBPR credential is the license mailing / headquarters-base county. It does not prove the contractor serves the entire county, works only there, or pulled permits there.",
  },
  {
    id: "deregulated-classes",
    title: "Unlicensed and deregulated work classes",
    summary:
      "Not every home-service job is a CILB contractor class. Some specialties were preempted from local occupational licensing. Absence of a CILB credential is not automatically proof of illegal work — check the correct board and the local building official.",
  },
  {
    id: "storm-hiring",
    title: "Storm-chaser hiring risks",
    summary:
      "After storms, unsolicited door-knocking, large cash deposits, and pressure to sign immediately are warning signs. Verify the full license class, the business name on the contract, and local permitting. This is research, not an emergency referral.",
    href: "/guides/florida-contractor-red-flags",
  },
  {
    id: "how-to-read-regulatory",
    title: "How to interpret regulatory evidence",
    summary:
      "A complaint or notice is not a final finding. An investigation is not enforcement. Multiple action rows can belong to one matter. Florida statewide DBPR/DFS records associated with a mailing-county population are not “county enforcement actions.”",
  },
  {
    id: "check-permit-locally",
    title: "How to check a permit locally",
    summary:
      "Identify the city or unincorporated area of the jobsite, then use that AHJ’s permit search — not a countywide warehouse unless the source is proven countywide. Unincorporated Palm Beach: PZB. Unincorporated Broward / BMSD: county Building Code Division. Unincorporated Miami-Dade: RER Building (folio 30). Unincorporated Pinellas and Accela partner cities: county BDRS. Municipal jobs use that city’s portal.",
  },
];
