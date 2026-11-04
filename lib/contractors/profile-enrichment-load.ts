import "server-only";
import type { QueryResultRow } from "pg";
import { queryOne } from "@/lib/db";
import {
  profileEnrichmentCacheReadSql,
  profileEnrichmentSelectSql,
  signalsFromFlags,
  type ProfileEnrichment,
  type ProfileEnrichmentSignal,
} from "./profile-enrichment";

type CacheRow = QueryResultRow & {
  enriched: boolean;
  signals: string[] | null;
  content_changed_at: Date | string | null;
};

type LiveFlagRow = QueryResultRow & Record<ProfileEnrichmentSignal | "content_changed_at", boolean | Date | string | null>;

function isUndefinedTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P01";
}

function contentChangedAtIso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function fromLiveRow(row: LiveFlagRow): ProfileEnrichment {
  const flags = signalsFromFlags({
    business_contact: row.business_contact === true,
    public_contact: row.public_contact === true,
    confirmed_permit: row.confirmed_permit === true,
    osha: row.osha === true,
    discipline: row.discipline === true,
    business_managed: row.business_managed === true,
  });
  const changed = row.content_changed_at;
  return {
    ...flags,
    contentChangedAt: contentChangedAtIso(changed instanceof Date || typeof changed === "string" ? changed : null),
  };
}

/**
 * Robots decision for one profile. Reads the refreshed cache so it matches
 * the sitemap. Before migration 021 is applied, a missing table falls back
 * to the single-contractor predicate. Any other error is rethrown.
 */
export async function getProfileEnrichment(contractorId: string): Promise<ProfileEnrichment> {
  try {
    const row = await queryOne<CacheRow>(profileEnrichmentCacheReadSql(), [contractorId]);
    if (!row || row.enriched !== true) return { enriched: false, signals: [], contentChangedAt: null };
    const signalList = Array.isArray(row.signals) ? row.signals : [];
    const flags = signalsFromFlags({
      business_contact: signalList.includes("business_contact"),
      public_contact: signalList.includes("public_contact"),
      confirmed_permit: signalList.includes("confirmed_permit"),
      osha: signalList.includes("osha"),
      discipline: signalList.includes("discipline"),
      business_managed: signalList.includes("business_managed"),
    });
    return {
      enriched: true,
      signals: flags.signals,
      contentChangedAt: contentChangedAtIso(row.content_changed_at),
    };
  } catch (error) {
    if (!isUndefinedTable(error)) throw error;
    const live = await queryOne<LiveFlagRow>(profileEnrichmentSelectSql(), [contractorId]);
    if (!live) return { enriched: false, signals: [], contentChangedAt: null };
    return fromLiveRow(live);
  }
}
