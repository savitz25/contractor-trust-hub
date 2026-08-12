import { bathroomStudio } from "./bathroom";
import { kitchenStudio } from "./kitchen";
import { roofingStudio } from "./roofing";
import type { StudioDefinition } from "./types";
import type { ProjectTypeId } from "@/lib/plan/types";

const STUDIOS: StudioDefinition[] = [kitchenStudio, bathroomStudio, roofingStudio];

export function listStudios(): StudioDefinition[] {
  return STUDIOS;
}

export function getStudioBySlug(slug: string): StudioDefinition | null {
  return STUDIOS.find((s) => s.slug === slug) ?? null;
}

export function getStudioByProjectType(type: ProjectTypeId): StudioDefinition | null {
  return STUDIOS.find((s) => s.projectType === type) ?? null;
}

export function isStudioSlug(slug: string): boolean {
  return STUDIOS.some((s) => s.slug === slug);
}
