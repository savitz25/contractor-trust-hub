/**
 * Backward-compatible entry: loads Wave A–C via Stage 8C loader.
 * Prefer: npm run load:permits
 *
 * Usage: node scripts/load_wave_a_permits.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(
  process.execPath,
  [path.join(dir, "load_wave_permits.mjs"), ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env }
);
child.on("exit", (code) => process.exit(code ?? 1));
