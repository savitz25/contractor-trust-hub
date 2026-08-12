import type { ProjectMilestone } from "./types";

export const DEFAULT_MILESTONES: { id: string; label: string }[] = [
  { id: "contract_signed", label: "Contract signed" },
  { id: "permit_obtained", label: "Permit obtained" },
  { id: "start_demo", label: "Demolition / start" },
  { id: "rough_inspections", label: "Rough inspections" },
  { id: "progress_mid", label: "Key progress point" },
  { id: "final_inspection", label: "Final inspection" },
  { id: "final_payment", label: "Final payment" },
  { id: "warranty_docs", label: "Warranty docs received" },
];

export function freshMilestones(): ProjectMilestone[] {
  return DEFAULT_MILESTONES.map((m) => ({ ...m, done: false }));
}
