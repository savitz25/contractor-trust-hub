"use client";

import React, { useId, useState } from "react";
import {
  sortOshaInspectionDetails,
  formatOshaCitationStatus,
  formatOshaInspectionStatus,
  verifiedOshaInspectionUrl,
  type OshaInspectionDetail,
  type OshaInspectionDetailsPage,
} from "@/lib/osha/inspection-details";
import { formatCitedPenalty } from "@/lib/osha/public-record";

type Props = {
  fixtureId?: string;
  detailUrl?: string;
  paginationDemo?: boolean;
};

function isDetailsPage(value: unknown): value is OshaInspectionDetailsPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<OshaInspectionDetailsPage>;
  return (
    Array.isArray(page.inspections) &&
    Number.isInteger(page.totalInspections) &&
    (page.nextCursor === null || typeof page.nextCursor === "string") &&
    (page.reconciliation === null ||
      (page.reconciliation != null &&
        Number.isInteger(page.reconciliation.expectedCitationItems) &&
        Number.isInteger(page.reconciliation.detailCitationItems)))
  );
}

function isNewestFirst(inspections: readonly OshaInspectionDetail[]): boolean {
  try {
    const sorted = sortOshaInspectionDetails(inspections);
    return inspections.every((item, index) => item.activityNumber === sorted[index]?.activityNumber);
  } catch {
    return false;
  }
}

function validatePage(page: OshaInspectionDetailsPage, paginationDemo: boolean): boolean {
  if (!isNewestFirst(page.inspections)) return false;
  if (paginationDemo) return page.reconciliation === null;
  return (
    page.reconciliation !== null &&
    page.reconciliation.expectedCitationItems === page.reconciliation.detailCitationItems &&
    page.inspections.every((inspection) => inspection.citations !== null)
  );
}

function inspectionLocation(inspection: OshaInspectionDetail): string | null {
  const city = inspection.city?.trim();
  const state = inspection.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  return null;
}

function Inspection({
  inspection,
  paginationDemo,
}: {
  inspection: OshaInspectionDetail;
  paginationDemo: boolean;
}) {
  const officialUrl = verifiedOshaInspectionUrl(inspection);
  const location = inspectionLocation(inspection);
  const inspectionStatus = formatOshaInspectionStatus(inspection);
  return (
    <li className="min-w-0 rounded-lg border border-amber-200 bg-white p-3 sm:p-4" data-testid="osha-inspection">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-[#0A2540]">
            Inspection {inspection.activityNumber}
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            {inspection.citations === null
              ? "Citation count unavailable"
              : `${inspection.citations.length} ${inspection.citations.length === 1 ? "citation" : "citations"}`}
          </p>
          <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">Opened: </dt>
              <dd className="inline tabular-nums">{inspection.openDate ?? "Date unavailable"}</dd>
            </div>
            {location ? (
              <div>
                <dt className="inline font-medium">Site: </dt>
                <dd className="inline">{location}</dd>
              </div>
            ) : null}
            {inspection.inspectionType ? (
              <div>
                <dt className="inline font-medium">Inspection type: </dt>
                <dd className="inline">{inspection.inspectionType}</dd>
              </div>
            ) : null}
            {inspectionStatus ? (
              <div>
                <dt className="inline font-medium">Inspection status: </dt>
                <dd className="inline">{inspectionStatus}</dd>
              </div>
            ) : null}
            {inspection.closingConferenceDate ? (
              <div>
                <dt className="inline font-medium">Closing conference: </dt>
                <dd className="inline">{inspection.closingConferenceDate}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {officialUrl ? (
          <a
            className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-semibold text-amber-950 underline decoration-amber-700 underline-offset-2 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View official OSHA inspection
          </a>
        ) : null}
      </div>

      <div className="mt-3 border-t border-amber-100 pt-3">
        <h4 className="text-sm font-semibold text-[#0A2540]">Citations</h4>
        {inspection.citations === null ? (
          <p className="mt-2 text-sm text-slate-700" data-testid="osha-citations-unavailable">
            {paginationDemo
              ? "Citation details are not included in this pagination preview."
              : "Citation details are temporarily unavailable."}
          </p>
        ) : inspection.citations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-700" data-testid="osha-zero-citations">
            No citations issued.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {inspection.citations.map((citation) => {
              const status = formatOshaCitationStatus(citation);
              return (
                <li
                  className="min-w-0 rounded-md bg-amber-50 p-3 text-sm"
                  key={`${inspection.activityNumber}-${citation.citationId}`}
                  data-testid="osha-citation"
                >
                  <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="inline font-medium">Standard cited: </dt>
                      <dd className="inline break-words">{citation.standard}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Type: </dt>
                      <dd className="inline">{citation.citationType}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Cited penalty (current): </dt>
                      <dd className="inline tabular-nums">{formatCitedPenalty(citation.currentPenalty)}</dd>
                    </div>
                    {status ? (
                      <div className="sm:col-span-2">
                        <dt className="inline font-medium">Status: </dt>
                        <dd className="inline break-words">{status}</dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}

export function OshaInspectionDetails({ fixtureId, detailUrl, paginationDemo = false }: Props) {
  const controlsId = useId();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inspections, setInspections] = useState<readonly OshaInspectionDetail[]>([]);
  const [totalInspections, setTotalInspections] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function loadPage(cursor: string | null) {
    setLoading(true);
    setError(false);
    try {
      const base = detailUrl ?? (fixtureId ? `/api/preview/osha-safety-record/${encodeURIComponent(fixtureId)}/details` : null);
      if (!base) throw new Error("OSHA detail route is unavailable");
      const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base;
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("OSHA detail request failed");
      const body: unknown = await response.json();
      if (!isDetailsPage(body) || !validatePage(body, paginationDemo)) {
        throw new Error("OSHA detail response failed validation");
      }
      const combined = cursor ? [...inspections, ...body.inspections] : [...body.inspections];
      if (!isNewestFirst(combined)) throw new Error("OSHA detail order is not stable");
      setInspections(combined);
      setTotalInspections(body.totalInspections);
      setNextCursor(body.nextCursor);
      setLoaded(true);
    } catch {
      if (!cursor) {
        setInspections([]);
        setLoaded(false);
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleDetails() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !loaded && !loading) void loadPage(null);
  }

  return (
    <div className="mt-3 min-w-0 border-t border-amber-200 pt-3">
      <button
        type="button"
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-amber-800 px-3 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={toggleDetails}
        data-testid="osha-details-toggle"
      >
        <span>{expanded ? "Hide inspection details" : "View inspection details"}</span>
        <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>

      <section
        id={controlsId}
        className="mt-3 min-w-0 border-t border-amber-100 pt-3"
        hidden={!expanded}
        aria-label="OSHA inspection details"
        aria-busy={loading}
        data-testid="osha-details-panel"
      >
        {loading ? <p className="text-sm text-slate-700" role="status">Loading inspection details…</p> : null}
        {error ? (
          <div className="flex min-w-0 flex-col items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
            <p>Inspection details are temporarily unavailable.</p>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-amber-950 underline underline-offset-2 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
              onClick={() => void loadPage(null)}
              disabled={loading}
              data-testid="osha-details-retry"
            >
              Retry
            </button>
          </div>
        ) : null}
        {loaded ? (
          <>
            <p className="mb-3 text-xs text-slate-600" aria-live="polite">
              Showing {inspections.length} of {totalInspections} inspections
            </p>
            {inspections.length > 0 ? (
              <ol className="min-w-0 space-y-3" data-testid="osha-inspection-list">
                {inspections.map((inspection) => (
                  <Inspection
                    key={inspection.activityNumber}
                    inspection={inspection}
                    paginationDemo={paginationDemo}
                  />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-700">Inspection details are temporarily unavailable.</p>
            )}
            {nextCursor ? (
              <button
                type="button"
                className="mt-3 inline-flex min-h-11 items-center rounded-md border border-amber-800 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
                onClick={() => void loadPage(nextCursor)}
                disabled={loading}
                data-testid="osha-show-more"
              >
                {loading ? "Loading…" : "Show more"}
              </button>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
