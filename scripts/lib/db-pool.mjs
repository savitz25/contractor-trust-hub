/**
 * Shared Postgres pool for ops scripts (Stage 8C).
 */
import pg from "pg";

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function createPool() {
  const url = getDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL (or POSTGRES_URL) is not set.");
    process.exit(1);
  }
  return {
    url,
    pool: new pg.Pool({
      connectionString: url,
      ssl:
        url.includes("supabase") || url.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
      max: 2,
    }),
  };
}

export function normalizeLicenseKey(key) {
  if (!key) return "";
  return String(key)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizePermitStatus(raw) {
  const h = String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (["open", "closed", "expired", "issued", "finaled", "unknown"].includes(h))
    return h;
  if (/expir|void|cancel|withdraw|revok|deni|reject/.test(h)) return "expired";
  if (/final|completed|complete|co final|occupancy/.test(h)) return "finaled";
  if (/issued|issue|approved issued/.test(h)) return "issued";
  if (/closed|archived|done/.test(h)) return "closed";
  if (/open|progress|pending|applied|active|submitted/.test(h)) return "open";
  return "unknown";
}

export function slugFromJurisdiction(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("miami")) return "miami-dade";
  if (l.includes("broward")) return "broward";
  if (l.includes("orange")) return "orange";
  if (l.includes("hillsborough") || l.includes("tampa")) return "hillsborough";
  if (l.includes("palm")) return "palm-beach";
  if (l.includes("duval") || l.includes("jacksonville")) return "duval";
  if (l.includes("pinellas")) return "pinellas";
  if (l.includes("lee")) return "lee";
  if (l.includes("collier")) return "collier";
  if (l.includes("sarasota")) return "sarasota";
  if (l.includes("pasco")) return "pasco";
  if (l.includes("polk")) return "polk";
  return "unknown";
}

export function waveForSlug(slug) {
  if (["miami-dade", "broward", "orange", "hillsborough"].includes(slug)) return "A";
  if (["palm-beach", "duval", "pinellas", "lee"].includes(slug)) return "B";
  if (["collier", "sarasota", "pasco", "polk"].includes(slug)) return "C";
  return "future";
}

export const WAVE_SLUGS = {
  A: ["miami-dade", "broward", "orange", "hillsborough"],
  B: ["palm-beach", "duval", "pinellas", "lee"],
  C: ["collier", "sarasota", "pasco", "polk"],
};
