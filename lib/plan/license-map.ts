/**
 * Project type → DBPR occupation code mapping (maintainable config).
 * Source of truth: data/plan/project-license-map.json
 */

import mapJson from "@/data/plan/project-license-map.json";
import type { ProjectTypeId } from "./types";

export type LicenseMapEntry = {
  label: string;
  primary: string[];
  secondary: string[];
  notes: string;
};

type MapFile = {
  _meta: { description: string; updated: string };
  mappings: Record<string, LicenseMapEntry>;
};

const file = mapJson as MapFile;

export function getLicenseMapEntry(projectType: ProjectTypeId): LicenseMapEntry {
  const entry = file.mappings[projectType];
  if (!entry) {
    return {
      label: projectType,
      primary: ["CGC", "CBC", "CRC"],
      secondary: [],
      notes: "Fallback general contractor classes.",
    };
  }
  return entry;
}

/** All codes used for a project (primary first). */
export function occupationCodesForProject(projectType: ProjectTypeId): {
  primary: string[];
  secondary: string[];
  all: string[];
} {
  const e = getLicenseMapEntry(projectType);
  const primary = e.primary.map((c) => c.toUpperCase());
  const secondary = e.secondary.map((c) => c.toUpperCase());
  const all = [...primary, ...secondary.filter((c) => !primary.includes(c))];
  return { primary, secondary, all };
}

export function licenseMapNotes(projectType: ProjectTypeId): string {
  return getLicenseMapEntry(projectType).notes;
}

export function licenseMapMeta(): { description: string; updated: string } {
  return file._meta;
}
