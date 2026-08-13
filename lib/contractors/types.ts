export type LicenseStatus =
  | "active"
  | "inactive"
  | "current"
  | "other"
  | "unknown";

export type SearchResult = {
  id: string;
  slug: string;
  displayName: string;
  legalName: string | null;
  dbaName: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  primaryLicenseKey: string | null;
  occupationCode: string | null;
  licenseStatus: LicenseStatus | null;
  entityStatus: string | null;
  entityName: string | null;
  hasDiscipline: boolean;
  lastVerifiedAt: string | null;
  /** License/registration source_system (e.g. fl_dbpr, nj_dca, tx_tdlr) */
  sourceSystem?: string | null;
};

export type LicenseDetail = {
  id: string;
  externalKey: string;
  occupationCode: string;
  licenseNumber: string | null;
  statusNormalized: LicenseStatus | null;
  primaryStatus: string | null;
  secondaryStatus: string | null;
  originalLicensureDate: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countyName: string | null;
  boardNumber: string | null;
  lastVerifiedAt: string | null;
  sourceSystem: string;
};

export type EntityDetail = {
  id: string;
  externalKey: string;
  legalName: string;
  status: string | null;
  entityType: string | null;
  formationDate: string | null;
  principalAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  registeredAgentName: string | null;
  officers: Array<{
    title?: string;
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }>;
  matchMethod: string | null;
  matchConfidence: number | null;
  lastVerifiedAt: string | null;
  sourceSystem: string;
};

export type DisciplineDetail = {
  id: string;
  complaintNumber: string | null;
  licenseType: string | null;
  classification: string | null;
  disposition: string | null;
  dispositionDate: string | null;
  disciplineDescription: string | null;
  violationCode: string | null;
  enteredDate: string | null;
  sourceDataset: string;
  lastVerifiedAt: string | null;
};

export type ContractorDetail = {
  id: string;
  slug: string;
  displayName: string;
  legalName: string | null;
  dbaName: string | null;
  primaryCity: string | null;
  primaryCounty: string | null;
  homeState: string | null;
  isThinProfile: boolean;
  licenses: LicenseDetail[];
  entities: EntityDetail[];
  discipline: DisciplineDetail[];
};
