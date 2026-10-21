import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OshaSafetyRecord } from "@/components/contractor/OshaSafetyRecord";
import { OshaInspectionDetails } from "@/components/contractor/OshaInspectionDetails";
import { OshaSafetyRecordPreviewCard } from "@/components/contractor/OshaSafetyRecord";
import { getOshaDetailPreviewFixture } from "@/data/preview/con-osha-001b-details";
import {
  OSHA_NO_MATCH_FIXTURE,
  OSHA_PREVIEW_SAMPLES,
  previewRecord,
  previewRecords,
} from "@/data/preview/con-osha-001-fixtures";
import { oshaPreviewShowcaseAllowed } from "@/lib/osha/flag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSHA safety record preview",
  robots: { index: false, follow: false },
};

const OSHA_PREVIEW_SOURCE_LIMIT =
  "Production detail data will remain disconnected until the verified source contract is wired. Interactive examples on this page use separate public-data fixtures.";

type Params = Promise<{ sample?: string }>;

export default async function OshaSafetyRecordPreview({ searchParams }: { searchParams: Params }) {
  if (!oshaPreviewShowcaseAllowed(process.env)) notFound();
  const sp = await searchParams;
  const sampleId = (sp.sample || "").trim();
  const detailFixture = getOshaDetailPreviewFixture(sampleId);
  const one = sampleId ? previewRecord(sampleId) : null;
  const records = detailFixture
    ? []
    : one
      ? [one]
      : sampleId === OSHA_NO_MATCH_FIXTURE.fixtureId || sampleId === "weak-match"
        ? []
        : previewRecords();
  const showEmpty = sampleId === OSHA_NO_MATCH_FIXTURE.fixtureId || !sampleId;
  const correctionHref = "/corrections?slug=osha-preview-fixture&license=preview";

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 overflow-x-hidden px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
        Non-production preview
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-[#0A2540]">OSHA Safety Record samples</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#0A2540]">
        These are public-data-based fixtures for the profile card. The license keys are the public
        license identifiers from the source match. They are not contractor profiles, and this page
        is not available in production.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-[#0A2540]">
        {OSHA_PREVIEW_SAMPLES.map((sample) => (
          <li key={sample.fixtureId}>
            {sample.state} · {sample.fixtureId} · {sample.matchTier} · {sample.scenario}
          </li>
        ))}
        <li>
          {OSHA_NO_MATCH_FIXTURE.state} · {OSHA_NO_MATCH_FIXTURE.fixtureId} ·{" "}
          {OSHA_NO_MATCH_FIXTURE.scenario}
        </li>
      </ul>
      <nav className="mt-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Interactive detail preview scenarios">
        <h2 className="text-sm font-semibold text-[#0A2540]">Interactive detail scenarios</h2>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["public-citations", "Multiple inspections and citations"],
            ["public-zero", "Verified zero-citation inspection"],
            ["pagination-demo", "Show more pagination"],
            ["load-failure", "Temporary detail-load failure"],
            ["weak-match", "Weak match stays hidden"],
            [OSHA_NO_MATCH_FIXTURE.fixtureId, "No-match stays hidden"],
          ].map(([id, label]) => (
            <li key={id}>
              <a
                className="inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-amber-950 underline decoration-amber-700 underline-offset-2 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                href={`?sample=${encodeURIComponent(id)}`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <aside
        className="mt-8 max-w-full min-w-0 rounded-lg border border-dashed border-amber-700 bg-white p-4 text-sm leading-relaxed text-[#0A2540]"
        data-testid="osha-preview-source-limit"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
          Non-production source limit
        </p>
        <p className="mt-2 break-words">{OSHA_PREVIEW_SOURCE_LIMIT}</p>
      </aside>
      {records.length > 0 ? (
        <div className="mt-8">
          <OshaSafetyRecord records={records} correctionHref={correctionHref} />
        </div>
      ) : null}
      {detailFixture && detailFixture.id !== "pagination-demo" && detailFixture.summary ? (
        <section className="mt-8" aria-labelledby="osha-detail-preview-title">
          <h2 id="osha-detail-preview-title" className="sr-only">{detailFixture.heading}</h2>
          <p className="mb-3 rounded-md border border-dashed border-amber-700 bg-white p-3 text-sm text-[#0A2540]">
            {detailFixture.note}
          </p>
          <OshaSafetyRecordPreviewCard
            fixtureId={detailFixture.id}
            identityLabel={detailFixture.identityLabel}
            summary={detailFixture.summary}
            currentPenalty={detailFixture.currentPenalty ?? 0}
            correctionHref={correctionHref}
          />
        </section>
      ) : null}
      {detailFixture?.id === "pagination-demo" ? (
        <section className="mt-8 max-w-full min-w-0 rounded-xl border-2 border-amber-700 bg-amber-50 p-4 text-[#0A2540] sm:p-5" data-testid="osha-pagination-demo">
          <h2 className="text-lg font-semibold text-amber-950">{detailFixture.heading}</h2>
          <p className="mt-2 break-words text-sm leading-relaxed">{detailFixture.note}</p>
          <OshaInspectionDetails fixtureId={detailFixture.id} paginationDemo />
          <p className="mt-4 break-words text-sm leading-relaxed">Citations are allegations by OSHA and may be contested, reduced, or withdrawn. A citation is not a final finding of violation.</p>
        </section>
      ) : null}
      {sampleId === "weak-match" ? (
        <p className="mt-8 rounded-md border border-slate-200 bg-white p-4 text-sm text-[#0A2540]" data-testid="osha-weak-match-hidden">
          Weak-match records are not available in this public preview.
        </p>
      ) : null}
      {showEmpty && !one ? (
        <section className="mt-8 max-w-full min-w-0" data-testid="osha-no-match-fixture">
          <h2 className="text-lg font-semibold text-[#0A2540]">No-match fixture</h2>
          <p className="mt-2 text-sm text-[#0A2540]">{OSHA_NO_MATCH_FIXTURE.scenario}</p>
        </section>
      ) : null}
    </main>
  );
}
