import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyResultView } from "@/components/property/PropertyResultView";
import { researchProperty } from "@/lib/property/resolve";
import { propertyResultHref } from "@/lib/property/session";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Property research results",
  description: "Florida property permit research result.",
  path: "/property/results",
  noIndex: true,
});

type Props = {
  searchParams: Promise<{
    street?: string;
    zip?: string;
    city?: string;
    unit?: string;
  }>;
};

export default async function PropertyResultsPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (!sp.street || !sp.zip) {
    redirect("/property");
  }

  const result = researchProperty({
    street: sp.street,
    zip: sp.zip,
    city: sp.city,
    unit: sp.unit,
    state: "FL",
  });

  // Prefer canonical id URL when resolved
  if (result.propertyId && result.resolveStatus !== "unresolved") {
    redirect(propertyResultHref(result));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/property" className="text-sm text-[var(--muted)] no-underline">
        ← New address
      </Link>
      <div className="mt-4">
        <PropertyResultView result={result} />
      </div>
    </main>
  );
}
