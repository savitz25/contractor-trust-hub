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
  const s = status.toLowerCase();
  if (s === "active") return "Active";
  if (s === "inactive") return "Inactive";
  if (s === "current") return "Current";
  if (s === "dissolved") return "Dissolved";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusTone(
  status: string | null | undefined
): "good" | "warn" | "bad" | "neutral" {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "current") return "good";
  if (s === "inactive" || s === "dissolved") return "bad";
  if (s === "other" || s === "unknown" || !s) return "neutral";
  return "warn";
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
