"use client";

import { loadJson, saveJson } from "@/lib/decision/session";
import { PROJECTS_KEY, loadStore, saveStore } from "@/lib/projects/store";
import type { ProjectsStore } from "@/lib/projects/types";
import type { DurableWorkspace, HomePassport } from "./types";
import { DEFAULT_ALERT_PREFS, emptyWorkspace } from "./types";

export const WORKSPACE_KEY = "cth-durable-workspace-v2";
export const PASSPORT_KEY = "cth-passports-v1";

/** Build local durable workspace from Stage 4 project store + passports. */
export function loadLocalWorkspace(): DurableWorkspace {
  const stored = loadJson<DurableWorkspace>(WORKSPACE_KEY);
  const projectsStore = loadStore();
  const passports =
    stored?.passports ||
    loadJson<HomePassport[]>(PASSPORT_KEY) ||
    [];

  if (stored?.version === 2) {
    return {
      ...emptyWorkspace(),
      ...stored,
      projectsStore: projectsStore.projects.length
        ? projectsStore
        : stored.projectsStore || projectsStore,
      passports,
      alertPreferences: { ...DEFAULT_ALERT_PREFS, ...stored.alertPreferences },
    };
  }

  return {
    version: 2,
    projectsStore,
    passports,
    alertPreferences: { ...DEFAULT_ALERT_PREFS },
    savedPropertyIds: [],
    updatedAt: new Date().toISOString(),
  };
}

export function saveLocalWorkspace(ws: DurableWorkspace): void {
  saveJson(WORKSPACE_KEY, { ...ws, updatedAt: new Date().toISOString() });
  // Keep Stage 4 key in sync for existing UIs
  saveStore(ws.projectsStore);
  saveJson(PASSPORT_KEY, ws.passports);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cth-workspace-change", { detail: ws }));
  }
}

export function getLocalProjectsStore(): ProjectsStore {
  return loadLocalWorkspace().projectsStore;
}

export function listLocalPassports(): HomePassport[] {
  return loadLocalWorkspace().passports.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getLocalPassport(id: string): HomePassport | null {
  return loadLocalWorkspace().passports.find((p) => p.id === id) || null;
}

export function upsertLocalPassport(passport: HomePassport): void {
  const ws = loadLocalWorkspace();
  const i = ws.passports.findIndex((p) => p.id === passport.id);
  if (i >= 0) ws.passports[i] = passport;
  else ws.passports.unshift(passport);
  saveLocalWorkspace(ws);
}

export { PROJECTS_KEY };
