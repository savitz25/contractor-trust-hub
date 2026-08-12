/** Stage 4 — Project Protection Layer types (session-first, durable-ready). */

export type ProjectStatus =
  | "planning"
  | "under_contract"
  | "in_progress"
  | "complete";

export type FindingStatus = "present" | "missing" | "unclear";

export type ContractFinding = {
  id: string;
  category: "core" | "protection" | "florida";
  label: string;
  status: FindingStatus;
  detail: string;
  evidence?: string;
};

export type ContractAnalysis = {
  id: string;
  contractorName?: string;
  contractorSlug?: string;
  projectType?: string;
  rawText: string;
  parseConfidence: "low" | "medium" | "high";
  parseNotes: string[];
  findings: ContractFinding[];
  questions: string[];
  counts: { present: number; missing: number; unclear: number };
  generatedAt: string;
};

export type ProjectDocumentKind =
  | "scope"
  | "quote"
  | "contract"
  | "coi"
  | "permit"
  | "change_order"
  | "lien_waiver"
  | "photo"
  | "inspection"
  | "other";

export type ProjectDocument = {
  id: string;
  kind: ProjectDocumentKind;
  label: string;
  /** Metadata only in v1 — no file bytes in localStorage */
  note?: string;
  addedAt: string;
};

export type ProjectMilestone = {
  id: string;
  label: string;
  done: boolean;
  doneAt?: string;
};

export type PaymentRecord = {
  id: string;
  amount: number | null;
  date: string;
  method: string;
  milestoneLabel: string;
  notes?: string;
  hasInvoice: boolean;
  hasLienWaiver: boolean;
  hasChangeOrderRef: boolean;
  completed: boolean;
};

export type ContractorSnapshot = {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
  watchedAt: string;
  lastCheckedAt: string;
};

export type WatchAlert = {
  id: string;
  contractorSlug: string;
  contractorName: string;
  kind: "license_status" | "discipline" | "entity_status" | "related_entity" | "info";
  message: string;
  detectedAt: string;
  read: boolean;
  projectId?: string;
};

export type Project = {
  id: string;
  title: string;
  projectType: string;
  status: ProjectStatus;
  address?: string;
  zip?: string;
  city?: string;
  county?: string;
  propertyId?: string;
  contractAmount?: number | null;
  budgetNote?: string;
  contractorSlug?: string;
  contractorName?: string;
  contractorLicenseKey?: string;
  watchContractor: boolean;
  milestones: ProjectMilestone[];
  payments: PaymentRecord[];
  documents: ProjectDocument[];
  contractAnalysisId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsStore = {
  projects: Project[];
  watches: ContractorSnapshot[];
  alerts: WatchAlert[];
  analyses: ContractAnalysis[];
  version: 1;
};
