import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env.local without logging values. Encode `$` in URI userinfo. */
export function loadContractorEnv(root = process.cwd()): void {
  const p = resolve(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k === "DATABASE_URL" || k === "POSTGRES_URL") v = v.replace(/\$@/, "%24@");
    if (!process.env[k]) process.env[k] = v;
  }
}
