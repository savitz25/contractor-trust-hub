import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanResults } from "@/components/plan/PlanResults";
import { parsePlanQuery } from "@/lib/plan/plan-url";

export const metadata: Metadata = {
  title: "Project results — cost ranges & verified contractors",
  description:
    "Conceptual cost ranges and verified Florida contractors for your project context. Planning only — not a formal bid.",
  robots: { index: false, follow: true },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanResultsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const plan = parsePlanQuery(sp);
  if (!plan) {
    redirect("/plan");
  }

  return (
    <main>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-12">
          <nav className="text-xs font-medium text-[var(--muted)]">
            <Link href="/plan" className="no-underline hover:text-[var(--navy)]">
              Plan
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[var(--text)]">Results</span>
          </nav>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
            Your project context
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
            Cost ranges for planning only. Contractors from official license data — evidence over
            invention.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <PlanResults plan={plan} />
      </section>
    </main>
  );
}
