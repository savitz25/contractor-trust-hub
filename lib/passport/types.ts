import type { Project, ProjectsStore, WatchAlert } from "@/lib/projects/types";

/** Stage 5 durable workspace + Home Passport types. */

export type AlertPreferences = {
  watchLicense: boolean;
  watchDiscipline: boolean;
  watchEntity: boolean;
  projectPaymentDocs: boolean;
  projectCompletion: boolean;
  warrantyReminders: boolean;
  emailEnabled: boolean;
};

export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  watchLicense: true,
  watchDiscipline: true,
  watchEntity: true,
  projectPaymentDocs: true,
  projectCompletion: true,
  warrantyReminders: true,
  emailEnabled: true,
};

export type WarrantyRecord = {
  id: string;
  title: string;
  category: string;
  provider?: string;
  startDate?: string;
  expiresAt?: string;
  notes?: string;
  projectId?: string;
  reminderOptIn?: boolean;
  createdAt: string;
};

export type MaterialRecord = {
  id: string;
  label: string;
  category: string;
  details?: string;
  createdAt: string;
};

export type PassportDocument = {
  id: string;
  kind: string;
  label: string;
  note?: string;
  projectId?: string;
  addedAt: string;
};

export type CompletedProjectEntry = {
  id: string;
  projectId?: string;
  projectType: string;
  title: string;
  completedAt: string;
  contractorName?: string;
  contractorSlug?: string;
  amount?: number | null;
  permitSummary?: string;
  warrantyReceived?: boolean;
  finalPaymentDocumented?: boolean;
  notes?: string;
  documentLabels?: string[];
};

export type HomePassport = {
  id: string;
  /** Stable key: normalized address or propertyId */
  propertyKey: string;
  addressLabel: string;
  zip?: string;
  city?: string;
  county?: string;
  notes?: string;
  improvements: CompletedProjectEntry[];
  warranties: WarrantyRecord[];
  materials: MaterialRecord[];
  documents: PassportDocument[];
  contractorSlugs: string[];
  createdAt: string;
  updatedAt: string;
};

/** Full durable payload stored in user_workspace.payload */
export type DurableWorkspace = {
  version: 2;
  projectsStore: ProjectsStore;
  passports: HomePassport[];
  alertPreferences: AlertPreferences;
  savedPropertyIds?: string[];
  updatedAt: string;
};

export type ProjectCompletionInput = {
  completionDate: string;
  finalAmount?: number | null;
  permitCloseout?: string;
  warrantyDocsReceived: boolean;
  finalPaymentDocumented: boolean;
  notes?: string;
  keepWatch: boolean;
  saveToPassport: boolean;
};

export function emptyWorkspace(): DurableWorkspace {
  return {
    version: 2,
    projectsStore: {
      version: 1,
      projects: [],
      watches: [],
      alerts: [],
      analyses: [],
    },
    passports: [],
    alertPreferences: { ...DEFAULT_ALERT_PREFS },
    savedPropertyIds: [],
    updatedAt: new Date().toISOString(),
  };
}

export type { Project, WatchAlert };
