/**
 * KY-CON-001: existing DHBC production Verify load.
 * This sprint did not re-extract the roster. The counts are the recorded product load.
 */
export const KY_SNAPSHOT = {
  regulator: "Kentucky Department of Housing, Buildings and Construction",
  searchUrl: "https://dhbc.ky.gov/Search/HBC_List_Licensees.aspx",
  overviewUrl: "https://dhbc.ky.gov/newstatic_Info.aspx?static_ID=573",
  openRecordsUrl: "https://ppc.ky.gov/NewOpenRecords.aspx",
  verifyPath: "/verify?state=ky",
  productRecord: "KENTUCKY_VERIFY_V1 production ky_dhbc load",
  productRecordNote:
    "Recorded production load of Active contractor-level rows. Not re-extracted on 2026-10-05. Not a company census.",
  publishedAt: "2026-10-05",
  classes: [
    {
      code: "ELEC",
      label: "Contractor Electrician-Business",
      grain: "business-license",
      status: "Active",
      rows: 3884,
      sampleKey: "KY-DHBC:CE62402",
    },
    {
      code: "HVAC",
      label: "Master HVAC Contractor",
      grain: "business-license",
      status: "Active",
      rows: 2699,
      sampleKey: "KY-DHBC:HM06343",
    },
    {
      code: "PLB",
      label: "Master Plumber",
      grain: "business-license",
      status: "Active",
      rows: 1777,
      sampleKey: "KY-DHBC:M7396",
    },
  ],
  recordedLicenseRows: 8360,
  statewideGeneralContractorLicense: "DOES_NOT_EXIST",
  masterElectricianIndividuals: "NOT_IN_THIS_LOAD",
  apprenticesJourneymenInspectors: "NOT_IN_THIS_LOAD",
  fireCredentials: "NOT_ACQUIRED",
  manufacturedHousing: "NOT_ACQUIRED",
  localLicenses: "NOT_STATEWIDE",
  discipline: "NOT_ACQUIRED",
  classificationsOnListView: "NOT_ON_LIST_VIEW",
  openRecordsRequest: "NOT_FILED",
  newCanonicalCompanies: 0,
  graphWrites: 0,
  claimEligibilityChanges: 0,
} as const;
