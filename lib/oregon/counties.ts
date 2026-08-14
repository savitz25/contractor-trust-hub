import type { CountyDef } from "@/lib/discovery/types";

/**
 * Oregon CCB counties from official county_name / county_code on the
 * Active Licenses extract. Codes are CCB county codes, not FIPS.
 */
export const OREGON_COUNTIES: CountyDef[] = [
  { slug: "baker", name: "Baker", matchNames: ["Baker"], matchCodes: ["1"] },
  { slug: "benton", name: "Benton", matchNames: ["Benton"], matchCodes: ["2"] },
  { slug: "clackamas", name: "Clackamas", matchNames: ["Clackamas"], matchCodes: ["3"] },
  { slug: "clatsop", name: "Clatsop", matchNames: ["Clatsop"], matchCodes: ["4"] },
  { slug: "columbia", name: "Columbia", matchNames: ["Columbia"], matchCodes: ["5"] },
  { slug: "coos", name: "Coos", matchNames: ["Coos"], matchCodes: ["6"] },
  { slug: "crook", name: "Crook", matchNames: ["Crook"], matchCodes: ["7"] },
  { slug: "curry", name: "Curry", matchNames: ["Curry"], matchCodes: ["8"] },
  { slug: "deschutes", name: "Deschutes", matchNames: ["Deschutes"], matchCodes: ["9"] },
  { slug: "douglas", name: "Douglas", matchNames: ["Douglas"], matchCodes: ["10"] },
  { slug: "gilliam", name: "Gilliam", matchNames: ["Gilliam"], matchCodes: ["11"] },
  { slug: "grant", name: "Grant", matchNames: ["Grant"], matchCodes: ["12"] },
  { slug: "harney", name: "Harney", matchNames: ["Harney"], matchCodes: ["13"] },
  { slug: "hood-river", name: "Hood River", matchNames: ["Hood River"], matchCodes: ["14"] },
  { slug: "jackson", name: "Jackson", matchNames: ["Jackson"], matchCodes: ["15"] },
  { slug: "jefferson", name: "Jefferson", matchNames: ["Jefferson"], matchCodes: ["16"] },
  { slug: "josephine", name: "Josephine", matchNames: ["Josephine"], matchCodes: ["17"] },
  { slug: "klamath", name: "Klamath", matchNames: ["Klamath"], matchCodes: ["18"] },
  { slug: "lake", name: "Lake", matchNames: ["Lake"], matchCodes: ["19"] },
  { slug: "lane", name: "Lane", matchNames: ["Lane"], matchCodes: ["20"] },
  { slug: "lincoln", name: "Lincoln", matchNames: ["Lincoln"], matchCodes: ["21"] },
  { slug: "linn", name: "Linn", matchNames: ["Linn"], matchCodes: ["22"] },
  { slug: "malheur", name: "Malheur", matchNames: ["Malheur"], matchCodes: ["23"] },
  { slug: "marion", name: "Marion", matchNames: ["Marion"], matchCodes: ["24"] },
  { slug: "morrow", name: "Morrow", matchNames: ["Morrow"], matchCodes: ["25"] },
  { slug: "multnomah", name: "Multnomah", matchNames: ["Multnomah"], matchCodes: ["26"] },
  { slug: "polk", name: "Polk", matchNames: ["Polk"], matchCodes: ["27"] },
  { slug: "sherman", name: "Sherman", matchNames: ["Sherman"], matchCodes: ["28"] },
  { slug: "tillamook", name: "Tillamook", matchNames: ["Tillamook"], matchCodes: ["29"] },
  { slug: "umatilla", name: "Umatilla", matchNames: ["Umatilla"], matchCodes: ["30"] },
  { slug: "union", name: "Union", matchNames: ["Union"], matchCodes: ["31"] },
  { slug: "wallowa", name: "Wallowa", matchNames: ["Wallowa"], matchCodes: ["32"] },
  { slug: "wasco", name: "Wasco", matchNames: ["Wasco"], matchCodes: ["33"] },
  { slug: "washington", name: "Washington", matchNames: ["Washington"], matchCodes: ["34"] },
  { slug: "wheeler", name: "Wheeler", matchNames: ["Wheeler"], matchCodes: ["35"] },
  { slug: "yamhill", name: "Yamhill", matchNames: ["Yamhill"], matchCodes: ["36"] },
  {
    slug: "out-of-state",
    name: "Out of state",
    matchNames: ["Out of State", "Out-of-State"],
    matchCodes: ["0"],
  },
];

export const OREGON_GEO_NOTE =
  "County comes from the official CCB Active Licenses county field. “Out of state” means a non-Oregon mailing address — not the jobsite. Those firms can still hold an Oregon CCB credential.";
