/**
 * Washington ZIP5 → county crosswalk for discovery rollups.
 *
 * L&I does not publish an official county field. This map is a maintained
 * USPS-style assignment of 5-digit ZIPs that appear (or can appear) on the
 * extract. It is query-time only — never written onto license rows.
 *
 * Multi-county ZIPs are assigned to the majority county and called out in
 * product copy. ZIP3 is not used (980/982/983/986/985 mix counties).
 */

function range(from: number, to: number, skip: number[] = []): string[] {
  const out: string[] = [];
  for (let n = from; n <= to; n++) {
    if (!skip.includes(n)) out.push(String(n));
  }
  return out;
}

function assign(map: Record<string, string>, county: string, zips: string[]): void {
  for (const zip of zips) map[zip] = county;
}

export const WA_ZIP_TO_COUNTY: Record<string, string> = {};

// King — 981xx except Bainbridge (98110 = Kitsap). 980xx King portion.
assign(WA_ZIP_TO_COUNTY, "King", [
  ...range(98001, 98011),
  ...range(98013, 98019),
  ...range(98022, 98025),
  ...range(98027, 98035),
  ...range(98038, 98042),
  ...range(98045, 98077, [98043, 98046]),
  "98083",
  "98089",
  "98092",
  "98093",
  "98288", // Skykomish
  ...range(98101, 98199, [98110]),
]);

// Snohomish — 980xx Snohomish cities + Everett / Marysville / Monroe 982xx
assign(WA_ZIP_TO_COUNTY, "Snohomish", [
  "98012",
  "98020",
  "98021",
  "98026",
  "98036",
  "98037",
  "98043",
  "98046",
  "98082",
  "98087",
  "98201",
  ...range(98203, 98208),
  "98213",
  "98223",
  "98241",
  "98251",
  "98252",
  "98256",
  "98258",
  "98270",
  "98271",
  "98272",
  "98275",
  "98287",
  ...range(98290, 98294),
  "98296",
]);

// Pierce — Tacoma 984xx + Pierce 983xx (not Kitsap / Mason)
assign(WA_ZIP_TO_COUNTY, "Pierce", [
  "98303",
  "98304",
  "98321",
  "98323",
  "98327",
  "98328",
  "98329",
  "98330",
  "98332",
  "98333",
  "98335",
  "98338",
  "98344",
  "98348",
  "98349",
  "98351",
  "98354",
  "98360",
  ...range(98371, 98375),
  "98385",
  "98387",
  "98388",
  "98390",
  "98391",
  "98396",
  "98397",
  "98398",
  "98580",
  ...range(98401, 98499),
]);

// Spokane — city 992xx + suburban 990xx (omit Lincoln / Stevens / Whitman ZIPs)
assign(WA_ZIP_TO_COUNTY, "Spokane", [
  "99001",
  "99003",
  "99004",
  "99005",
  "99006",
  "99009",
  "99011",
  "99012",
  "99014",
  "99016",
  "99018",
  "99019",
  "99020",
  "99021",
  "99022",
  "99023",
  "99025",
  "99026",
  "99027",
  "99030",
  "99031",
  "99036",
  "99037",
  "99039",
  ...range(99201, 99224),
  "99228",
  "99251",
  "99252",
  "99256",
  "99258",
  "99260",
]);

// Clark — Vancouver / Camas / Battle Ground (omit Cowlitz 98626/32/74)
assign(WA_ZIP_TO_COUNTY, "Clark", [
  "98601",
  "98604",
  "98606",
  "98607",
  "98622",
  "98629",
  "98642",
  ...range(98660, 98668),
  "98671",
  "98675",
  ...range(98682, 98687),
]);

// Kitsap — Bremerton / Poulsbo / Bainbridge
assign(WA_ZIP_TO_COUNTY, "Kitsap", [
  "98110",
  ...range(98310, 98312),
  "98314",
  "98315",
  "98322",
  "98337",
  "98340",
  "98342",
  "98345",
  "98346",
  "98353",
  "98359",
  "98366",
  "98367",
  "98370",
  "98378",
  "98380",
  "98383",
  "98384",
  "98386",
  "98392",
  "98393",
]);

// Whatcom — Bellingham / Lynden / Ferndale
assign(WA_ZIP_TO_COUNTY, "Whatcom", [
  "98220",
  ...range(98225, 98231),
  "98240",
  "98244",
  "98247",
  "98248",
  "98262",
  "98264",
  "98266",
  "98276",
  "98281",
  "98295",
]);

// Thurston — Olympia / Lacey / Tumwater
assign(WA_ZIP_TO_COUNTY, "Thurston", [
  ...range(98501, 98513),
  "98516",
  "98530",
  "98540",
  "98556",
  "98576",
  "98579",
  "98589",
  "98597",
]);

// Benton — Kennewick / Richland / Prosser (Pasco 99301 is Franklin — omitted)
assign(WA_ZIP_TO_COUNTY, "Benton", [
  "99320",
  "99336",
  "99337",
  "99338",
  "99345",
  "99346",
  "99350",
  "99352",
  "99353",
  "99354",
]);

// Yakima
assign(WA_ZIP_TO_COUNTY, "Yakima", [
  ...range(98901, 98904),
  ...range(98907, 98909),
  "98920",
  "98921",
  "98923",
  "98930",
  "98932",
  "98933",
  ...range(98935, 98939),
  "98942",
  "98944",
  "98947",
  "98948",
  ...range(98951, 98953),
]);

export function zipsForCounty(countyName: string): string[] {
  return Object.entries(WA_ZIP_TO_COUNTY)
    .filter(([, county]) => county.toLowerCase() === countyName.toLowerCase())
    .map(([zip]) => zip)
    .sort();
}
