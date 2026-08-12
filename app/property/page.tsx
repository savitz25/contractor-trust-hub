import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddressLookupForm } from "@/components/property/AddressLookupForm";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Check My Address — property & permit research",
  description:
    "Look up a Florida property for permit history signals and planning context. Progressive coverage — honest empty states. Not a title search or legal determination.",
  path: "/property",
});

function FormFromQuery({
  zip,
  city,
}: {
  zip?: string;
  city?: string;
}) {
  return <AddressLookupForm initialZip={zip} initialCity={city} />;
}

export default async function PropertyEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ zip?: string; city?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        Property research
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Check my address
      </h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
        Investigate permit and jurisdiction context for a Florida property — then connect to
        contractor verification and decision tools. Evidence only; coverage is progressive and often
        incomplete.
      </p>

      <div className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
          <FormFromQuery zip={sp.zip} city={sp.city} />
        </Suspense>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/tools/permit-planner"
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm no-underline"
        >
          <p className="font-semibold text-[var(--text)]">Permit &amp; Inspection Planner</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Project-type guidance without an address</p>
        </Link>
        <Link
          href="/verify"
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm no-underline"
        >
          <p className="font-semibold text-[var(--text)]">Verify a contractor</p>
          <p className="mt-1 text-xs text-[var(--muted)]">License evidence Trust Report</p>
        </Link>
      </div>
    </main>
  );
}
