/**
 * Florida-specific consumer education. No living production counts.
 * Qualifier text is conceptual — no statewide relationship statistics.
 */

export type IntelligenceEducationModule = {
  id: string;
  title: string;
  summary: string;
  href?: string;
};

export const FLORIDA_INTELLIGENCE_EDUCATION: IntelligenceEducationModule[] = [
  {
    id: "certified-vs-registered",
    title: "Certified vs registered contractors",
    summary:
      "Certified contractors are licensed by the state Construction Industry Licensing Board and may work where that license is recognized, subject to local permitting. Registered contractors operate under a more limited local-jurisdiction framework. Always confirm the class on the DBPR record and with the local building department. This is education, not legal advice.",
    href: "/guides/florida-contractor-license-types",
  },
  {
    id: "qualifying-agent",
    title: "How a Florida qualifying agent works",
    summary:
      "Florida construction businesses may operate through licensed qualifying agents. DBPR related-license records distinguish Primary Qualifying Agents, Second Qualifying Agents, and financial-responsibility roles (which are not trade licenses). Trust Hub is building regulator-backed relationship research for those roles. Statewide relationship counts are not published yet.",
  },
  {
    id: "how-to-verify",
    title: "How to verify a Florida contractor license",
    summary:
      "Ask for the full license number (for example CCC1336585, not digits alone), confirm the occupation class matches the work, check status, and compare the listed business name to the company on the contract. Confirm current status on DBPR before you hire.",
    href: "/guides/how-to-verify-florida-contractor",
  },
  {
    id: "when-licensing-applies",
    title: "When Florida contractor licensing applies",
    summary:
      "CILB licenses cover construction contracting occupations the board regulates. Not every home-service job is a CILB contractor license. Local building permits, other boards (for example electrical), and job-size rules can still apply. Absence of a CILB credential is not automatically proof of illegal work.",
  },
  {
    id: "deregulation-limits",
    title: "Trades that may not appear in the CILB universe",
    summary:
      "Painting, cleaning, some handyman work, and other services may fall outside CILB contractor classes. Electrical, alarm, and certain other occupations are regulated separately. Do not treat “no CILB license in our search” as a verdict that someone is unlicensed or illegal. Check the correct board and the local building official.",
  },
  {
    id: "recovery-fund",
    title: "Florida Homeowners’ Construction Recovery Fund",
    summary:
      "The Recovery Fund is a statutory program for certain eligible homeowners after specified contractor problems and unpaid judgments. A Recovery Fund record is not the same as a current license status, and a claim file is not automatically a final finding against every similarly named business. Eligibility is set by Florida law.",
  },
  {
    id: "workers-comp",
    title: "Workers’ compensation considerations",
    summary:
      "Florida DFS publishes stop-work and related workers’ compensation enforcement lists. Those records are collected as public-record observations. A stop-work notice is not automatically a CILB license revocation, and name-only matches are not treated as confirmed identity on this site.",
  },
  {
    id: "permits",
    title: "Permits and why homeowners should verify them",
    summary:
      "A state contractor credential is not a substitute for a local building permit. Permit history, when Trust Hub has it, will be labeled as operating evidence and will not be inferred from the license mailing county. Ask the contractor who pulls the permit and confirm with the local building department.",
  },
  {
    id: "storm-hiring",
    title: "Storm and hurricane contractor hiring",
    summary:
      "After storms, unsolicited door-knocking, large cash deposits, and pressure to sign immediately are common warning signs. Verify the full license class, the business name on the contract, and local permitting. Trust Hub is a research system, not an emergency contractor referral service.",
    href: "/guides/florida-contractor-red-flags",
  },
  {
    id: "unlicensed-contracting",
    title: "Unlicensed contracting",
    summary:
      "DBPR publishes unlicensed-activity records separately from licensed-contractor discipline. Those files often lack a board license number. Trust Hub retains them as research observations and does not treat them as a ranked list of “bad contractors.”",
  },
];
