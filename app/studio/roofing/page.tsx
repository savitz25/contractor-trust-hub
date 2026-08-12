import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { RoofingCostCalculator } from "@/components/studio/RoofingCostCalculator";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Roofing Cost Calculator — Florida planning ranges",
  description:
    "Interactive Florida roof replacement planning calculator. Adjust size, material, stories, and complexity — then find verified CCC/RR roofing contractors. Planning only, not a bid.",
  path: "/studio/roofing",
});

export default function RoofingCalculatorPage() {
  return (
    <main>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Cost Studio", path: "/studio/cost" },
          { name: "Roofing calculator", path: "/studio/roofing" },
        ]}
      />
      <section className="border-b border-[var(--border)] bg-white/70">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-12">
          <nav className="text-xs font-medium text-[var(--muted)]">
            <Link href="/studio/cost" className="no-underline hover:text-[var(--navy)]">
              Cost Studio
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[var(--text)]">Roofing calculator</span>
          </nav>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy)]">
            Florida · planning tool
          </p>
          <h1 className="mt-2 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            Roofing Cost Calculator
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Size the main drivers that move a Florida reroof — roof size, system type, access, and
            complexity — then continue to verified roofing licenses.{" "}
            <strong className="font-medium text-[var(--text)]">
              Planning only — never a bid or contractor quote.
            </strong>
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Other project types?{" "}
            <Link href="/studio/cost" className="font-medium text-[var(--navy)] hover:underline">
              Cost Studio
            </Link>
            {" · "}
            Already have a roofer&apos;s name?{" "}
            <Link href="/verify" className="font-medium text-[var(--navy)] hover:underline">
              Verify
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <RoofingCostCalculator />
      </section>
    </main>
  );
}
