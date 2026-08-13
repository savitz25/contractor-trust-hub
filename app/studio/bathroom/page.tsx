import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { BathroomCostCalculator } from "@/components/studio/BathroomCostCalculator";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Bathroom Cost Calculator — Florida planning ranges",
  description:
    "Interactive Florida bathroom remodel planning calculator. Adjust bath type, depth, layout, and finish — then find verified licensed contractors. Planning only, not a bid.",
  path: "/studio/bathroom",
});

export default function BathroomCalculatorPage() {
  return (
    <main>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Cost Studio", path: "/studio/cost" },
          { name: "Bathroom calculator", path: "/studio/bathroom" },
        ]}
      />
      <section className="border-b border-[var(--border)] bg-white/70">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-12">
          <nav className="text-xs font-medium text-[var(--muted)]">
            <Link href="/studio/cost" className="no-underline hover:text-[var(--navy)]">
              Cost Studio
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[var(--text)]">Bathroom calculator</span>
          </nav>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy)]">
            Florida · planning tool
          </p>
          <h1 className="mt-2 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            Bathroom Cost Calculator
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Size the drivers that move a Florida bathroom remodel — powder vs primary, refresh vs
            gut, fixture moves, and finish level — then continue to verified licenses.{" "}
            <strong className="font-medium text-[var(--text)]">
              Planning only — never a bid or contractor quote.
            </strong>
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Prefer a question-by-question guide?{" "}
            <Link href="/studios/bathroom" className="font-medium text-[var(--navy)] hover:underline">
              Bathroom Studio
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
        <BathroomCostCalculator />
      </section>
    </main>
  );
}
