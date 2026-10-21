import React from "react";
import {
  formatCitedPenalty,
  OSHA_INSPECTION_LIST_STATUS,
  OSHA_LEGAL_DISCLAIMER,
  OSHA_MATCH_METHOD,
  OSHA_PENALTY_LABEL,
  OSHA_REPORT_ERROR_LABEL,
  type OshaPublicRecord,
} from "@/lib/osha/public-record";

type Props = {
  records: OshaPublicRecord[];
  correctionHref: string;
  detailsOpen?: boolean;
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
  detailsOpen = false,
}: {
  record: OshaPublicRecord;
  correctionHref: string;
  detailsOpen?: boolean;
}) {
  const stateName = record.state === "FL" ? "Florida" : "New Jersey";
  return (
    <article
      data-testid="osha-safety-record"
      data-osha-state={record.state}
      data-osha-license={record.licenseKey}
      data-osha-inspection-list={OSHA_INSPECTION_LIST_STATUS}
      className="max-w-full min-w-0 overflow-x-hidden rounded-xl border-2 border-amber-700 bg-amber-50 p-4 text-[#0A2540] sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <HardHatIcon />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-amber-950">OSHA Safety Record</h2>
          <p className="mt-1 break-words text-sm text-amber-950">
            {stateName} license {record.licenseKey}
          </p>
        </div>
      </div>
      <p className="mt-4 break-words text-base font-medium leading-relaxed">{record.summary}</p>
      <p className="mt-3 break-words text-sm">
        <span className="font-semibold">{OSHA_PENALTY_LABEL}</span>
        <span className="tabular-nums"> {formatCitedPenalty(record.currentPenalty)}</span>
      </p>
      <details className="mt-4 max-w-full min-w-0" open={detailsOpen}>
        <summary className="cursor-pointer break-words rounded-md font-semibold text-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800">
          Inspection list blocked
        </summary>
        <div className="mt-3 max-w-full min-w-0 space-y-2 break-words text-sm leading-relaxed">
          <p>
            Per-inspection opening date, citation count, contest status, and final-order date are
            not in the verified handoff. This pilot does not list OSHA activity numbers or
            inspection links.
          </p>
          {record.nContested > 0 ? (
            <p>
              Source count of citation items that have a contest date: {record.nContested}. This is
              not a per-inspection contested status.
            </p>
          ) : null}
          {record.nWithFinalOrder > 0 ? (
            <p>
              Source count of citation items that have a final-order date: {record.nWithFinalOrder}.
              The date is not in this extract.
            </p>
          ) : null}
        </div>
      </details>
      <p className="mt-4 break-words text-sm leading-relaxed">{OSHA_LEGAL_DISCLAIMER}</p>
      <p className="mt-3 break-words text-sm leading-relaxed">
        {OSHA_MATCH_METHOD}{" "}
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

export function OshaSafetyRecord({ records, correctionHref, detailsOpen = false }: Props) {
  if (!records.length) return null;
  return (
    <div className="max-w-full min-w-0 space-y-4">
      {records.map((record) => (
        <OshaSafetyRecordCard
          key={`${record.state}-${record.licenseKey}`}
          record={record}
          correctionHref={correctionHref}
          detailsOpen={detailsOpen}
        />
      ))}
    </div>
  );
}
