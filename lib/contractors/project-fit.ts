/**
 * License-class fit notes when arriving from plan/studio context.
 */

import { getOccupationInfo } from "./occupations";
import type { ContractorDetail } from "./types";
import { occupationCodesForProject } from "@/lib/plan/license-map";
import type { ProjectTypeId } from "@/lib/plan/types";
import { isProjectTypeId } from "@/lib/plan/project-types";

export type ProjectFitNote = {
  projectType: ProjectTypeId;
  projectLabel: string;
  fit: "primary" | "secondary" | "other" | "unknown";
  headline: string;
  detail: string;
  codesOnProfile: string[];
  primaryCodes: string[];
  secondaryCodes: string[];
};

export function projectFitForContractor(
  contractor: ContractorDetail,
  projectTypeRaw?: string | null
): ProjectFitNote | null {
  if (!projectTypeRaw || !isProjectTypeId(projectTypeRaw)) return null;
  const mapped = occupationCodesForProject(projectTypeRaw);
  const codesOnProfile = contractor.licenses
    .map((l) => (l.occupationCode || "").toUpperCase())
    .filter(Boolean);
  const primary = mapped.primary.map((c) => c.toUpperCase());
  const secondary = mapped.secondary.map((c) => c.toUpperCase());

  let fit: ProjectFitNote["fit"] = "unknown";
  if (codesOnProfile.some((c) => primary.includes(c))) fit = "primary";
  else if (codesOnProfile.some((c) => secondary.includes(c))) fit = "secondary";
  else if (codesOnProfile.length) fit = "other";

  const labels = codesOnProfile
    .map((c) => `${c} (${getOccupationInfo(c).label})`)
    .join("; ");

  const headlines: Record<ProjectFitNote["fit"], string> = {
    primary: "License class on file is a primary match for this project type",
    secondary:
      "License class on file is a secondary / related class for this project type",
    other: "License class on file may not be the usual primary class for this project type",
    unknown: "License class fit could not be determined from this profile",
  };

  const details: Record<ProjectFitNote["fit"], string> = {
    primary: `Primary classes for this work typically include ${primary.join(", ") || "—"}. Profile shows: ${labels || "none"}. Evidence only — not an endorsement.`,
    secondary: `Primary classes (${primary.join(", ") || "—"}) were not found; secondary/related classes include ${secondary.join(", ") || "—"}. Profile shows: ${labels || "none"}. Review scope carefully.`,
    other: `Usual primary classes are ${primary.join(", ") || "—"}. Profile shows: ${labels || "none"}. Confirm this contractor is authorized for the work you need.`,
    unknown: "No occupation codes on this profile to compare against project mapping.",
  };

  return {
    projectType: projectTypeRaw,
    projectLabel: projectTypeRaw.replace(/_/g, " "),
    fit,
    headline: headlines[fit],
    detail: details[fit],
    codesOnProfile,
    primaryCodes: primary,
    secondaryCodes: secondary,
  };
}
