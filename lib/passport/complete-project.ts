import type { Project } from "@/lib/projects/types";
import type {
  CompletedProjectEntry,
  DurableWorkspace,
  HomePassport,
  ProjectCompletionInput,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function propertyKeyFromProject(p: Project): string {
  if (p.propertyId) return p.propertyId;
  const parts = [p.address || "", p.zip || "", p.city || ""].map((s) =>
    s.toUpperCase().replace(/\s+/g, " ").trim()
  );
  return parts.filter(Boolean).join("|") || `project:${p.id}`;
}

/**
 * Mark project complete and optionally add to Home Passport (pure function on workspace).
 */
export function completeProjectInWorkspace(
  workspace: DurableWorkspace,
  projectId: string,
  input: ProjectCompletionInput
): { workspace: DurableWorkspace; passportId: string | null; project: Project | null } {
  const projects = workspace.projectsStore.projects.map((p) => ({ ...p }));
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return { workspace, passportId: null, project: null };

  const project = {
    ...projects[idx],
    status: "complete" as const,
    contractAmount:
      input.finalAmount !== undefined && input.finalAmount !== null
        ? input.finalAmount
        : projects[idx].contractAmount,
    notes: [projects[idx].notes, input.notes].filter(Boolean).join("\n") || undefined,
    updatedAt: new Date().toISOString(),
    milestones: projects[idx].milestones.map((m) =>
      m.id === "final_payment" || m.id === "warranty_docs" || m.id === "final_inspection"
        ? {
            ...m,
            done: true,
            doneAt: m.doneAt || input.completionDate,
          }
        : m
    ),
  };

  if (input.warrantyDocsReceived) {
    project.milestones = project.milestones.map((m) =>
      m.id === "warranty_docs" ? { ...m, done: true, doneAt: input.completionDate } : m
    );
  }
  if (input.finalPaymentDocumented) {
    project.milestones = project.milestones.map((m) =>
      m.id === "final_payment" ? { ...m, done: true, doneAt: input.completionDate } : m
    );
  }

  projects[idx] = project;

  let passports = [...workspace.passports];
  let passportId: string | null = null;

  if (input.saveToPassport) {
    const key = propertyKeyFromProject(project);
    const addressLabel =
      project.address ||
      [project.city, project.zip].filter(Boolean).join(", ") ||
      project.title;

    let passport = passports.find((p) => p.propertyKey === key);
    if (!passport) {
      passport = {
        id: uid("pass"),
        propertyKey: key,
        addressLabel,
        zip: project.zip,
        city: project.city,
        county: project.county,
        improvements: [],
        warranties: [],
        materials: [],
        documents: [],
        contractorSlugs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      passports.push(passport);
    }

    const entry: CompletedProjectEntry = {
      id: uid("imp"),
      projectId: project.id,
      projectType: project.projectType,
      title: project.title,
      completedAt: input.completionDate,
      contractorName: project.contractorName,
      contractorSlug: project.contractorSlug,
      amount: project.contractAmount,
      permitSummary: input.permitCloseout || undefined,
      warrantyReceived: input.warrantyDocsReceived,
      finalPaymentDocumented: input.finalPaymentDocumented,
      notes: input.notes,
      documentLabels: project.documents.map((d) => d.label),
    };

    passport.improvements = [
      entry,
      ...passport.improvements.filter((i) => i.projectId !== project.id),
    ];
    if (project.contractorSlug && !passport.contractorSlugs.includes(project.contractorSlug)) {
      passport.contractorSlugs = [...passport.contractorSlugs, project.contractorSlug];
    }
    // Pull project docs into vault
    for (const d of project.documents) {
      if (!passport.documents.some((x) => x.label === d.label && x.projectId === project.id)) {
        passport.documents.push({
          id: uid("pdoc"),
          kind: d.kind,
          label: d.label,
          note: d.note,
          projectId: project.id,
          addedAt: d.addedAt,
        });
      }
    }
    passport.updatedAt = new Date().toISOString();
    passportId = passport.id;
    passports = passports.map((p) => (p.propertyKey === key ? passport! : p));
  }

  let watches = workspace.projectsStore.watches;
  if (!input.keepWatch && project.contractorSlug) {
    // leave watch unless user opts to keep — if keepWatch false, remove only if no other open projects use it
    const stillUsed = projects.some(
      (p) =>
        p.id !== project.id &&
        p.contractorSlug === project.contractorSlug &&
        p.status !== "complete"
    );
    if (!stillUsed) {
      watches = watches.filter((w) => w.slug !== project.contractorSlug);
      project.watchContractor = false;
      projects[idx] = project;
    }
  } else if (input.keepWatch && project.contractorSlug) {
    project.watchContractor = true;
    projects[idx] = project;
  }

  return {
    workspace: {
      ...workspace,
      projectsStore: {
        ...workspace.projectsStore,
        projects,
        watches,
      },
      passports,
      updatedAt: new Date().toISOString(),
    },
    passportId,
    project,
  };
}
