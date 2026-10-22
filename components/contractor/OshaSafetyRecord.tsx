import React from "react";
import {
  formatCitedPenalty,
  OSHA_LEGAL_DISCLAIMER,
  OSHA_MATCH_METHOD,
  OSHA_PENALTY_LABEL,
  OSHA_REPORT_ERROR_LABEL,
  oshaStateLicenseLabel,
  type OshaPublicRecord,
} from "@/lib/osha/public-record";
import { OshaInspectionDetails } from "@/components/contractor/OshaInspectionDetails";

type Props = {
  records: OshaPublicRecord[];
  correctionHref: string;
  contractorId?: string;
  detailEnabled?: boolean;
};

type CardRecord = {
  key: string;
  state: string;
  licenseKey?: string;
  identityLabel: string;
  summary: string;
  currentPenalty: number;
};

function HardHatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-amber-800">
      <path
        fill="currentColor"
        d="M12 2.5a1 1 0 0 1 1 1V5a7 7 0 0 1 6 6.9V14H5v-2.1A7 7 0 0 1 11 5V3.5a1 1 0 0 1 1-1Z"
      />
      <path
        fill="currentColor"
        d="M2.5 15.2h19a1 1 0 0 1 1 1V17a2.5 2.5 0 0 1-2.5 2.5h-16A2.5 2.5 0 0 1 1.5 17v-.8a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function OshaSafetyRecordCard({
  record,
  correctionHref,
  detailFixtureId,
  detailUrl,
  preview,
}: {
  record: CardRecord;
  correctionHref: string;
  detailFixtureId?: string;
  detailUrl?: string;
  preview?: boolean;
}) {
  return (
    <article
      data-testid="osha-safety-record"
      data-osha-state={record.state}
      data-osha-license={record.licenseKey}
      data-osha-preview-fixture={preview ? detailFixtureId : undefined}
      className="max-w-full min-w-0 overflow-x-hidden rounded-xl border-2 border-amber-700 bg-amber-50 p-4 text-[#0A2540] sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <HardHatIcon />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-amber-950">OSHA Safety Record</h2>
          <p className="mt-1 break-words text-sm text-amber-950">
            {record.identityLabel}
          </p>
        </div>
      </div>
      <p className="mt-4 break-words text-base font-medium leading-relaxed">{record.summary}</p>
      <p className="mt-3 break-words text-sm">
        <span className="font-semibold">{OSHA_PENALTY_LABEL}</span>
        <span className="tabular-nums"> {formatCitedPenalty(record.currentPenalty)}</span>
      </p>
      {detailUrl ? (
        <OshaInspectionDetails detailUrl={detailUrl} />
      ) : detailFixtureId ? (
        <OshaInspectionDetails fixtureId={detailFixtureId} />
      ) : null}
      <p className="mt-4 break-words text-sm leading-relaxed">{OSHA_LEGAL_DISCLAIMER}</p>
      <p className="mt-3 break-words text-sm leading-relaxed">
        {preview ? "This public example is not matched to a contractor." : OSHA_MATCH_METHOD}{" "}
        <a
          href={correctionHref}
          className="font-semibold text-amber-950 underline decoration-amber-700 underline-offset-2"
        >
          {OSHA_REPORT_ERROR_LABEL}
        </a>
      </p>
    </article>
  );
}

export function OshaSafetyRecord({ records, correctionHref, contractorId, detailEnabled = false }: Props) {
  if (!records.length) return null;
  return (
    <div className="max-w-full min-w-0 space-y-4">
      {records.map((record) => (
        <OshaSafetyRecordCard
          key={`${record.state}-${record.licenseKey}`}
          record={{
            key: `${record.state}-${record.licenseKey}`,
            state: record.state,
            licenseKey: record.licenseKey,
            identityLabel: oshaStateLicenseLabel(record.state, record.licenseKey),
            summary: record.summary,
            currentPenalty: record.currentPenalty,
          }}
          correctionHref={correctionHref}
          detailUrl={
            detailEnabled && record.detailEligible && contractorId && record.publicMatchId
              ? `/api/contractors/${encodeURIComponent(contractorId)}/osha-details?match=${encodeURIComponent(record.publicMatchId)}&state=${encodeURIComponent(record.state)}&license=${encodeURIComponent(record.licenseKey ?? "")}`
              : undefined
          }
        />
      ))}
    </div>
  );
}

/** Preview-only card model; it has no contractor/license identity or production data path. */
export function OshaSafetyRecordPreviewCard({
  fixtureId,
  identityLabel,
  summary,
  currentPenalty,
  correctionHref,
}: {
  fixtureId: string;
  identityLabel: string;
  summary: string;
  currentPenalty: number;
  correctionHref: string;
}) {
  return (
    <div className="max-w-full min-w-0">
      <OshaSafetyRecordCard
        record={{
          key: fixtureId,
          state: "preview",
          identityLabel,
          summary,
          currentPenalty,
        }}
        detailFixtureId={fixtureId}
        preview
        correctionHref={correctionHref}
      />
    </div>
  );
}
