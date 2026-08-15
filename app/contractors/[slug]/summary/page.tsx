import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareSummaryPrintTrigger } from "@/components/contractor/ShareSummaryPrintTrigger";
import { TrustReportShareSummary } from "@/components/contractor/TrustReportShareSummary";
import { getContractorBySlug } from "@/lib/contractors/queries";
import {
  buildShareSummary,
  shareSummaryPath,
} from "@/lib/contractors/share-summary";
import { absoluteUrl } from "@/lib/site";
import { pageMetadata } from "@/lib/seo/page-meta";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  try {
    const c = await getContractorBySlug(slug);
    if (!c) {
      return {
        title: "Summary not found",
        robots: { index: false, follow: true },
      };
    }
    return pageMetadata({
      title: `${c.displayName} — Evidence summary`,
      description: `Shareable license evidence summary for ${c.displayName}. Independent research — not a ranking or recommendation. Confirm on the official board.`,
      path: shareSummaryPath(c.slug),
      noIndex: true,
    });
  } catch {
    return {
      title: "Evidence summary",
      robots: { index: false, follow: true },
    };
  }
}

export default async function ContractorShareSummaryPage({
  params,
  searchParams,
}: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sp = await searchParams;
  const printFlag = sp.print === "1" || sp.print === "true";

  let contractor;
  try {
    contractor = await getContractorBySlug(slug);
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="text-xl font-semibold text-[var(--text)]">Unable to load summary</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Try again in a moment, or open the full Trust Report.
        </p>
        <Link
          href={`/contractors/${encodeURIComponent(slug)}`}
          className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)]"
        >
          Full Trust Report
        </Link>
      </main>
    );
  }

  if (!contractor) notFound();

  const model = buildShareSummary(contractor);
  const fullAbs = absoluteUrl(model.fullReportPath);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-0">
      <ShareSummaryPrintTrigger enabled={printFlag} />

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm print:hidden">
        <Link
          href={model.fullReportPath}
          className="text-[var(--muted)] no-underline hover:text-[var(--text)]"
        >
          Full Trust Report
        </Link>
        <span className="text-[var(--border)]" aria-hidden>
          ·
        </span>
        <span className="text-[var(--muted)]">Shareable evidence summary</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 print:hidden">
        <Link
          href={`${shareSummaryPath(contractor.slug)}?print=1`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-4 text-sm font-semibold text-white no-underline hover:brightness-110"
        >
          Print summary
        </Link>
        <a
          href={model.officialBoardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/30"
        >
          {model.officialBoardLabel}
        </a>
        <Link
          href={model.fullReportPath}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg)]"
        >
          Open full report
        </Link>
      </div>

      <TrustReportShareSummary model={model} fullReportAbsolute={fullAbs} />
    </main>
  );
}
