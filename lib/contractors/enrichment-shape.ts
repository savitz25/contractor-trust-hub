// MD-ENRICH-001 — pure shaping of business-website enrichment observations (no server import, unit-testable).
// These values were found on the business's own website. They are additional evidence, never DBPR facts:
// they do not replace the DBPR primary address, license class, status or identity.

export type EnrichmentField = "website" | "phone" | "email" | "address_location" | "specialty";

export type EnrichmentRow = {
  field: string;
  value: string;
  ordinal: number;
  is_suppressed: boolean;
  source_refs: string[] | null;
  observed_at: string | Date | null;
};

export type BusinessWebsiteEnrichment = {
  website: string | null;
  phones: string[];
  emails: string[];
  otherLocations: string[];
  services: string[];
  sourceUrls: string[];
  observedAt: string | null;
};

const PLACEHOLDER = /^(n\/?a|none|unknown|null|undefined|-+)$/i;

function clean(value: string | null | undefined): string | null {
  const v = (value || "").replace(/\s+/g, " ").trim();
  return v && !PLACEHOLDER.test(v) ? v : null;
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Suppressed rows never leave this function. Returns null when nothing public remains. */
export function shapeEnrichment(rows: ReadonlyArray<EnrichmentRow>): BusinessWebsiteEnrichment | null {
  const visible = rows
    .filter((r) => !r.is_suppressed)
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal);
  const pick = (field: EnrichmentField) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of visible) {
      if (r.field !== field) continue;
      const v = clean(r.value);
      if (!v || seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      out.push(v);
    }
    return out;
  };
  const website = safeHttpUrl(pick("website")[0] ?? null);
  const emails = pick("email").filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const shaped: BusinessWebsiteEnrichment = {
    website,
    phones: pick("phone"),
    emails,
    otherLocations: pick("address_location"),
    services: pick("specialty"),
    sourceUrls: [],
    observedAt: null,
  };
  const hasAny =
    shaped.website || shaped.phones.length || shaped.emails.length || shaped.otherLocations.length || shaped.services.length;
  if (!hasAny) return null;

  // Source links point at the business site, so they are shown only when that website is itself
  // public: a suppressed website must not resurface through the source refs of a public specialty row.
  const urls = new Map<string, string>(); // one link per host
  let observed: string | null = null;
  for (const r of visible) {
    for (const ref of website ? r.source_refs || [] : []) {
      const u = safeHttpUrl(clean(ref));
      if (u && !urls.has(websiteHost(u))) urls.set(websiteHost(u), u);
    }
    if (r.observed_at) {
      const iso = new Date(r.observed_at).toISOString();
      if (!observed || iso > observed) observed = iso;
    }
  }
  shaped.sourceUrls = [...urls.values()].slice(0, 5);
  shaped.observedAt = observed;
  return shaped;
}

/** `tel:` target from a display phone such as "(305) 555-0100 (Miami-Dade)". */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/\([^)]*[A-Za-z][^)]*\)/g, "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `tel:+1${ten}` : null;
}

export function websiteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
