import { additionStudio } from "./addition";
import { basementStudio } from "./basement";
import { bathroomStudio } from "./bathroom";
import { exteriorStudio } from "./exterior";
import { kitchenStudio } from "./kitchen";
import { roofingStudio } from "./roofing";
import { wholeHomeStudio } from "./whole-home";
import type { StudioDefinition } from "./types";
import type { ProjectTypeId } from "@/lib/plan/types";

const STUDIOS: StudioDefinition[] = [
  kitchenStudio,
  bathroomStudio,
  roofingStudio,
  additionStudio,
  basementStudio,
  exteriorStudio,
  wholeHomeStudio,
];

export function listStudios(): StudioDefinition[] {
  return STUDIOS;
}

export function getStudioBySlug(slug: string): StudioDefinition | null {
  return STUDIOS.find((s) => s.slug === slug) ?? null;
}

export function getStudioByProjectType(type: ProjectTypeId): StudioDefinition | null {
  return (
    STUDIOS.find((s) => s.projectType === type) ??
    STUDIOS.find((s) => s.relatedProjectTypes?.includes(type)) ??
    null
  );
}

export function isStudioSlug(slug: string): boolean {
  return STUDIOS.some((s) => s.slug === slug);
}
