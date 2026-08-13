import type { LicenseStatus } from "./types";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const s = status.toLowerCase().trim();
  if (s === "active") return "Active";
  if (s === "inactive") return "Inactive";
  if (s === "current") return "Current";
  if (s === "dissolved") return "Dissolved";
  if (s === "expired") return "Expired";
  if (s === "suspended") return "Suspended";
  if (s === "revoked") return "Revoked";
  if (s === "closed") return "Closed";
  if (s === "deceased") return "Deceased";
  if (s === "retired") return "Retired";
  if (s.includes("out of business")) return "Out of business";
  if (s.includes("voluntary surrender")) return "Voluntary surrender";
  if (s.includes("pending")) return "Pending";
  // Title-case multi-word board statuses (e.g. "Reinstatement Pending")
  return status
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function statusTone(
  status: string | null | undefined
): "good" | "warn" | "bad" | "neutral" {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "current") return "good";
  if (
    s === "inactive" ||
    s === "dissolved" ||
    s.includes("expired") ||
    s.includes("revoked") ||
    s.includes("suspended") ||
    s.includes("closed") ||
    s.includes("deceased") ||
    s.includes("retired") ||
    s.includes("out of business") ||
    s.includes("surrender")
  ) {
    return "bad";
  }
  if (s.includes("pending")) return "warn";
  if (s === "other" || s === "unknown" || !s) return "neutral";
  return "warn";
}

/** Prefer board raw status (Expired, Closed, …) over coarse normalized labels. */
export function displayStatusLabel(
  normalized: string | null | undefined,
  primaryRaw?: string | null | undefined
): string {
  const raw = (primaryRaw || "").trim();
  if (raw) return statusLabel(raw);
  return statusLabel(normalized);
}

export function asLicenseStatus(value: string | null): LicenseStatus | null {
  if (!value) return null;
  const s = value.toLowerCase();
  if (s === "active" || s === "inactive" || s === "current" || s === "other" || s === "unknown") {
    return s;
  }
  return "other";
}

export function matchMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "exact_name_address":
      return "Exact name + address + ZIP";
    case "exact_name_zip5":
      return "Exact name + ZIP";
    case "exact_name_city":
      return "Exact name + city";
    case "officer_name_zip":
      return "Officer name + address (high confidence)";
    default:
      return method || "Linked";
  }
}
