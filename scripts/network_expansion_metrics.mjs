/** Explicit grain bindings to accepted state contracts; no numeric totals here. */
export function appendExpansionMetrics(m, count) {
  const groups = {
    CO: [
      [
        "business_credentials.EC.active_exact",
        "Active Electrical Contractor credentials",
        "business_credential",
      ],
      [
        "business_credentials.PC.active_exact",
        "Active Plumbing Contractor credentials",
        "business_credential",
      ],
      [
        "business_credentials.combined_active_exact_if_shown.value",
        "Active EC + PC specialty credentials",
        "business_credential",
      ],
      [
        "discipline.contractor_relevant_rows",
        "Credential-linked disciplinary observations",
        "disciplinary_observation",
      ],
    ],
    NY: [
      [
        "debarment.registry_field_has_been_debarred_yes",
        "Historical debarred=yes periods",
        "historical_debarment_period",
      ],
    ],
    IL: [
      ["roofing.source_rows", "Roofing source rows", "roofing_source_row"],
      [
        "roofing.distinct_license_ids",
        "Distinct roofing credential IDs",
        "business_or_person_credential_id",
      ],
      [
        "business_licenses.active_business_y_rows",
        "Active business roofing source rows",
        "business_credential_source_row",
      ],
      [
        "qualifying_parties.active_distinct_license_ids",
        "Active Qualifying Party credential IDs",
        "person_credential_id",
      ],
      [
        "discipline.flag_rows",
        "Roofing disciplinary observations",
        "disciplinary_observation",
      ],
      [
        "discipline.flag_distinct_license_ids",
        "Credential IDs with disciplinary evidence",
        "credential_id_with_evidence",
      ],
    ],
    "new-york-city": [
      ["licenses.distinct_license_ids", "HIC license IDs", "license_id"],
      ["licenses.distinct_business_unique_ids", "HIC BUIDs", "dcwp_buid"],
      [
        "complaints.parsed_rows",
        "DCWP complaint observations",
        "complaint_observation",
      ],
      [
        "inspections.parsed_rows",
        "DCWP inspection observations",
        "inspection_observation",
      ],
      ["charges.parsed_rows", "DCWP charge observations", "charge_observation"],
      [
        "wall_of_shame.name_count",
        "Wall of Shame published names",
        "published_name",
      ],
    ],
    "new-york-city-dob": [
      [
        "dob_now.parsed_rows",
        "DOB NOW approved permit observations",
        "permit_observation",
      ],
      [
        "dob_now.distinct_permit_ids",
        "DOB NOW distinct permits",
        "dobnow_permit_id",
      ],
      [
        "dob_now.distinct_job_filing_numbers",
        "DOB NOW job filings",
        "job_filing_id",
      ],
      ["dob_now.distinct_bbls", "DOB NOW BBLs", "bbl"],
      ["dob_now.distinct_bins", "DOB NOW BINs", "bin"],
      ["legacy.distinct_permit_ids", "Legacy BIS permits", "bis_permit_id"],
      ["legacy.distinct_job_ids", "Legacy BIS jobs", "bis_job_id"],
      ["pluto.universe_rows", "PLUTO tax lots", "tax_lot"],
      ["pluto.matched_rows", "PLUTO exact BBL matches", "matched_bbl"],
    ],
    "new-york-city-acris": [
      [
        "master.parsed_rows",
        "ACRIS Master observations",
        "document_observation",
      ],
      [
        "master.distinct_document_ids",
        "ACRIS distinct documents",
        "document_id",
      ],
      ["legals.parsed_rows", "ACRIS legal rows", "legal_row"],
      ["linking.distinct_bbls", "ACRIS distinct BBLs", "bbl"],
      [
        "linking.documents_with_bbl",
        "ACRIS documents with BBLs",
        "document_id",
      ],
      [
        "master.display_group_counts.deed",
        "ACRIS deed-type observations",
        "deed_type_observation",
      ],
      [
        "master.display_group_counts.mortgage",
        "ACRIS mortgage-type observations",
        "mortgage_type_observation",
      ],
      [
        "linking.documents_with_gt1_bbl",
        "ACRIS multi-BBL documents",
        "document_id",
      ],
    ],
  };
  for (const prefix of Object.keys(
    m.acceptedStateDatasets.CO.snapshot.individual_trades.prefixes,
  ))
    groups.CO.push([
      "individual_trades.prefixes." + prefix + ".active_exact",
      "Active " + prefix + " person credentials",
      "person_credential",
    ]);
  for (const [state, rows] of Object.entries(groups)) {
    const local = state.startsWith("new-york-city"),
      { path, snapshot } =
        m.acceptedStateDatasets[
          local
            ? "lib/" + state + "-intelligence/accepted-snapshot.json"
            : state
        ];
    for (const [field, label, grain] of rows) {
      const value = count(
        field.split(".").reduce((d, k) => d?.[k], snapshot),
        path + "#" + field,
      );
      const section = field.split(".")[0],
        clocks = snapshot.clocks?.[section] ?? snapshot.clocks ?? {};
      const id = (state + "_" + field)
        .replaceAll("-", "_")
        .replaceAll(".", "_");
      const family =
        state.endsWith("-dob") || state.endsWith("-acris")
          ? "Permit / construction / work history"
          : /disciplin|complaint|inspection|charge|debarment|published_name/.test(
                grain,
              )
            ? "Regulatory / enforcement"
            : /person|buid/.test(grain)
              ? "Business evidence"
              : "License / registration";
      m.homepageEvidence.push({
        id,
        label: (local ? "NYC" : state) + " " + label,
        count: value,
        grain,
        family,
        geography: local ? "New York City" : state,
        artifact: path + "#" + field,
        sourceAsOf: clocks.sourceAsOf ?? null,
        retrievedAt:
          clocks.retrievedAt ?? snapshot.source?.retrieved_at ?? null,
        snapshotAsOf: snapshot.clocks?.snapshotAsOf ?? snapshot.as_of ?? null,
        generatedAt: m.generatedAt,
        counts: "Accepted " + grain + "; " + field + ".",
        doesNotCount:
          "Other grains, unique contractor companies, current ownership, current lender identity, or quality.",
        href: local
          ? "/new-york/new-york-city"
          : m.stateCapabilities.find((s) => s.state === state).route,
      });
    }
  }
}
