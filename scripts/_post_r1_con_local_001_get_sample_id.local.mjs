import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { executeContractorSpecialistQuery } = await import("../lib/specialist-execution/contractor-v2.ts");
const r = await executeContractorSpecialistQuery({ queryType: "cohort", state: "FL", trade: "plumbing", county: "miami-dade", limit: 3 });
console.log(JSON.stringify(r.rows?.map((x) => ({ name: x.name, credentialNumber: x.credentialNumber })), null, 2));
process.exit(0);
