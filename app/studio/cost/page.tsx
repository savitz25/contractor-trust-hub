import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { CostStudio } from "@/components/studio/CostStudio";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Cost Studio — Florida project planning ranges",
  description:
    "Interactive Florida cost planning bands for home projects. Adjust scope factors, then continue to verified licensed contractors. Planning only — not a bid.",
  path: "/studio/cost",
});

export default function CostStudioPage() {
  return (
    <main>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Cost Studio", path: "/studio/cost" },
        ]}
      />
      <section className="border-b border-[var(--border)] bg-white/70">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-12">
          <nav className="text-xs font-medium text-[var(--muted)]">
            <Link href="/plan" className="no-underline hover:text-[var(--navy)]">
              Plan
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[var(--text)]">Cost Studio</span>
          </nav>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy)]">
            Elevated planning · Florida
          </p>
          <h1 className="mt-2 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            Cost Studio
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Explore realistic planning bands for common Florida home projects. Adjust scope factors
            to see how finishes, complexity, and access move the range — then continue to verified
            license matches.{" "}
            <strong className="font-medium text-[var(--text)]">Never a bid or contractor quote.</strong>
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Kitchen specifically?{" "}
            <Link href="/studio/kitchen" className="font-medium text-[var(--navy)] hover:underline">
              Kitchen Cost Calculator
            </Link>
            {" · "}
            Bathroom?{" "}
            <Link href="/studio/bathroom" className="font-medium text-[var(--navy)] hover:underline">
              Bathroom calculator
            </Link>
            {" · "}
            Roofing?{" "}
            <Link href="/studio/roofing" className="font-medium text-[var(--navy)] hover:underline">
              Roofing calculator
            </Link>
            {" · "}
            Prefer a shorter intake?{" "}
            <Link href="/plan" className="font-medium text-[var(--navy)] hover:underline">
              Use Plan
            </Link>
            {" · "}
            Already have a name?{" "}
            <Link href="/verify" className="font-medium text-[var(--navy)] hover:underline">
              Verify
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <CostStudio />
      </section>
    </main>
  );
}
