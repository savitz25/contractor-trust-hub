"use client";

import { loadJson, saveJson } from "@/lib/decision/session";
import { freshMilestones } from "./milestones";
import type {
  ContractAnalysis,
  ContractorSnapshot,
  Project,
  ProjectDocument,
  ProjectStatus,
  ProjectsStore,
  PaymentRecord,
  WatchAlert,
} from "./types";

export const PROJECTS_KEY = "cth-projects-store-v1";

function emptyStore(): ProjectsStore {
  return { projects: [], watches: [], alerts: [], analyses: [], version: 1 };
}

export function loadStore(): ProjectsStore {
  const s = loadJson<ProjectsStore>(PROJECTS_KEY);
  if (!s || s.version !== 1) return emptyStore();
  return {
    projects: s.projects || [],
    watches: s.watches || [],
    alerts: s.alerts || [],
    analyses: s.analyses || [],
    version: 1,
  };
}

export function saveStore(store: ProjectsStore): void {
  saveJson(PROJECTS_KEY, store);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cth-projects-change", { detail: store }));
  }
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function listProjects(): Project[] {
  return loadStore().projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProject(id: string): Project | null {
  return loadStore().projects.find((p) => p.id === id) || null;
}

export type CreateProjectInput = {
  title?: string;
  projectType?: string;
  status?: ProjectStatus;
  address?: string;
  zip?: string;
  city?: string;
  county?: string;
  propertyId?: string;
  contractAmount?: number | null;
  contractorSlug?: string;
  contractorName?: string;
  contractorLicenseKey?: string;
  watchContractor?: boolean;
  notes?: string;
};

export function createProject(input: CreateProjectInput): Project {
  const store = loadStore();
  const now = new Date().toISOString();
  const project: Project = {
    id: uid("proj"),
    title:
      input.title ||
      `${input.projectType?.replace(/_/g, " ") || "Home"} project`,
    projectType: input.projectType || "general_contracting",
    status: input.status || "planning",
    address: input.address,
    zip: input.zip,
    city: input.city,
    county: input.county,
    propertyId: input.propertyId,
    contractAmount: input.contractAmount ?? null,
    contractorSlug: input.contractorSlug,
    contractorName: input.contractorName,
    contractorLicenseKey: input.contractorLicenseKey,
    watchContractor: Boolean(input.watchContractor),
    milestones: freshMilestones(),
    payments: [],
    documents: [],
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  store.projects.unshift(project);
  if (input.contractorSlug && input.watchContractor) {
    upsertWatch(store, {
      slug: input.contractorSlug,
      name: input.contractorName || input.contractorSlug,
      licenseKey: input.contractorLicenseKey,
      watchedAt: now,
      lastCheckedAt: now,
    });
  }
  saveStore(store);
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): Project | null {
  const store = loadStore();
  const i = store.projects.findIndex((p) => p.id === id);
  if (i < 0) return null;
  store.projects[i] = {
    ...store.projects[i],
    ...patch,
    id: store.projects[i].id,
    createdAt: store.projects[i].createdAt,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
  return store.projects[i];
}

export function deleteProject(id: string): void {
  const store = loadStore();
  store.projects = store.projects.filter((p) => p.id !== id);
  saveStore(store);
}

export function toggleMilestone(projectId: string, milestoneId: string): Project | null {
  const p = getProject(projectId);
  if (!p) return null;
  const milestones = p.milestones.map((m) =>
    m.id === milestoneId
      ? {
          ...m,
          done: !m.done,
          doneAt: !m.done ? new Date().toISOString() : undefined,
        }
      : m
  );
  return updateProject(projectId, { milestones });
}

export function addPayment(
  projectId: string,
  payment: Omit<PaymentRecord, "id">
): Project | null {
  const p = getProject(projectId);
  if (!p) return null;
  const next: PaymentRecord = { ...payment, id: uid("pay") };
  return updateProject(projectId, { payments: [...p.payments, next] });
}

export function updatePayment(
  projectId: string,
  paymentId: string,
  patch: Partial<PaymentRecord>
): Project | null {
  const p = getProject(projectId);
  if (!p) return null;
  const payments = p.payments.map((x) =>
    x.id === paymentId ? { ...x, ...patch, id: x.id } : x
  );
  return updateProject(projectId, { payments });
}

export function addDocument(
  projectId: string,
  doc: Omit<ProjectDocument, "id" | "addedAt">
): Project | null {
  const p = getProject(projectId);
  if (!p) return null;
  const documents: ProjectDocument[] = [
    ...p.documents,
    { ...doc, id: uid("doc"), addedAt: new Date().toISOString() },
  ];
  return updateProject(projectId, { documents });
}

export function saveAnalysis(analysis: ContractAnalysis): void {
  const store = loadStore();
  store.analyses = [analysis, ...store.analyses.filter((a) => a.id !== analysis.id)].slice(
    0,
    20
  );
  saveStore(store);
}

export function getAnalysis(id: string): ContractAnalysis | null {
  return loadStore().analyses.find((a) => a.id === id) || null;
}

function upsertWatch(
  store: ProjectsStore,
  snap: ContractorSnapshot
): void {
  const i = store.watches.findIndex((w) => w.slug === snap.slug);
  if (i >= 0) store.watches[i] = { ...store.watches[i], ...snap };
  else store.watches.unshift(snap);
}

export function watchContractor(input: {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
  projectId?: string;
}): ContractorSnapshot {
  const store = loadStore();
  const now = new Date().toISOString();
  const snap: ContractorSnapshot = {
    slug: input.slug,
    name: input.name,
    licenseKey: input.licenseKey,
    licenseStatus: input.licenseStatus ?? null,
    entityStatus: input.entityStatus ?? null,
    disciplineCount: input.disciplineCount ?? 0,
    watchedAt: now,
    lastCheckedAt: now,
  };
  upsertWatch(store, snap);
  if (input.projectId) {
    const p = store.projects.find((x) => x.id === input.projectId);
    if (p) {
      p.watchContractor = true;
      p.contractorSlug = input.slug;
      p.contractorName = input.name;
      p.updatedAt = now;
    }
  }
  saveStore(store);
  return snap;
}

export function unwatchContractor(slug: string): void {
  const store = loadStore();
  store.watches = store.watches.filter((w) => w.slug !== slug);
  store.projects = store.projects.map((p) =>
    p.contractorSlug === slug ? { ...p, watchContractor: false } : p
  );
  saveStore(store);
}

export function isWatching(slug: string): boolean {
  return loadStore().watches.some((w) => w.slug === slug);
}

export function listWatches(): ContractorSnapshot[] {
  return loadStore().watches;
}

export function listAlerts(): WatchAlert[] {
  return loadStore().alerts.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

/**
 * Compare current contractor evidence snapshot to watched baseline.
 * Called when user opens Trust Report or projects (on-refresh detection).
 */
export function checkWatchAgainstSnapshot(current: {
  slug: string;
  name: string;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
}): WatchAlert[] {
  const store = loadStore();
  const watched = store.watches.find((w) => w.slug === current.slug);
  if (!watched) return [];

  const now = new Date().toISOString();
  const newAlerts: WatchAlert[] = [];

  const push = (
    kind: WatchAlert["kind"],
    message: string
  ) => {
    // de-dupe same message in last 24h
    const recent = store.alerts.find(
      (a) =>
        a.contractorSlug === current.slug &&
        a.message === message &&
        Date.now() - new Date(a.detectedAt).getTime() < 86400000
    );
    if (recent) return;
    newAlerts.push({
      id: uid("alert"),
      contractorSlug: current.slug,
      contractorName: current.name,
      kind,
      message,
      detectedAt: now,
      read: false,
    });
  };

  if (
    watched.licenseStatus &&
    current.licenseStatus &&
    watched.licenseStatus !== current.licenseStatus
  ) {
    push(
      "license_status",
      `License status change detected in current board extracts (${watched.licenseStatus} → ${current.licenseStatus}).`
    );
  }
  if (
    watched.entityStatus &&
    current.entityStatus &&
    watched.entityStatus !== current.entityStatus
  ) {
    push(
      "entity_status",
      `Entity status appears changed in current extracts (${watched.entityStatus} → ${current.entityStatus}).`
    );
  }
  if (
    typeof watched.disciplineCount === "number" &&
    typeof current.disciplineCount === "number" &&
    current.disciplineCount > watched.disciplineCount
  ) {
    push(
      "discipline",
      "New discipline record identified in current extracts."
    );
  }

  // Update baseline to current
  watched.licenseStatus = current.licenseStatus ?? watched.licenseStatus;
  watched.entityStatus = current.entityStatus ?? watched.entityStatus;
  watched.disciplineCount = current.disciplineCount ?? watched.disciplineCount;
  watched.lastCheckedAt = now;
  watched.name = current.name || watched.name;

  if (newAlerts.length) {
    store.alerts = [...newAlerts, ...store.alerts].slice(0, 50);
  }
  saveStore(store);
  return newAlerts;
}

export function markAlertRead(id: string): void {
  const store = loadStore();
  store.alerts = store.alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
  saveStore(store);
}

export function paymentOutstanding(project: Project): PaymentRecord[] {
  return project.payments.filter(
    (p) => p.completed && (!p.hasInvoice || !p.hasLienWaiver)
  );
}
