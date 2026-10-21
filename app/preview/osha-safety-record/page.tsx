import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OshaSafetyRecord } from "@/components/contractor/OshaSafetyRecord";
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

type Params = Promise<{ sample?: string; expanded?: string }>;

export default async function OshaSafetyRecordPreview({ searchParams }: { searchParams: Params }) {
  if (!oshaPreviewShowcaseAllowed(process.env)) notFound();
  const sp = await searchParams;
  const sampleId = (sp.sample || "").trim();
  const expanded = sp.expanded === "1";
  const one = sampleId ? previewRecord(sampleId) : null;
  const records = one ? [one] : sampleId === OSHA_NO_MATCH_FIXTURE.fixtureId ? [] : previewRecords();
  const showEmpty = sampleId === OSHA_NO_MATCH_FIXTURE.fixtureId || (!sampleId && true);
  const correctionHref = "/corrections?slug=osha-preview-fixture&license=preview";

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 overflow-x-hidden px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
        Non-production preview
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-[#0A2540]">OSHA Safety Record samples</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#0A2540]">
        These fixtures exercise the profile card. They are not contractor profiles, and this page
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
      {records.length > 0 ? (
        <div className="mt-8">
          <OshaSafetyRecord
            records={records}
            correctionHref={correctionHref}
            detailsOpen={expanded}
          />
        </div>
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
