import type { Metadata } from "next";
import Link from "next/link";
import { parseContractorAskHandoff } from "@/lib/ask-handoff/parse";
import { resolveContractorAskHandoff } from "@/lib/ask-handoff/resolve";
import { AskSearchContextBanner } from "@/components/ask-handoff/AskSearchContextBanner";

export const metadata: Metadata = {
  title: "Search not available",
  description: "This Ask search is not a supported Florida contractor browse category.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContractorAskUnsupportedPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = parseContractorAskHandoff(params);
  const dest = ctx ? resolveContractorAskHandoff(ctx) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <AskSearchContextBanner ctx={ctx} />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--text)]">
        {dest?.bannerTitle || "No matching Florida contractor browse"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
        {dest?.bannerBody ||
          "ContractorTrustHub did not substitute a different trade or invent a service area."}
      </p>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Zero exact supported results is intentional. Broader browse is optional and requires a
        click — this page does not auto-widen electrical, solar, painting, or home inspectors into
        general contractors.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/florida"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Browse Florida counties (optional)
        </Link>
        <Link
          href="/verify"
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Search by name or license
        </Link>
      </div>
    </main>
  );
}
