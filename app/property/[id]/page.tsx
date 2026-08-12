import type { Metadata } from "next";
import Link from "next/link";
import { PropertyResultView } from "@/components/property/PropertyResultView";
import { decodePropertyId, researchProperty } from "@/lib/property/resolve";
import { pageMetadata } from "@/lib/seo/page-meta";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ city?: string; unit?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodePropertyId(decodeURIComponent(id));
  return pageMetadata({
    title: decoded
      ? `Property research — ${decoded.street}, ${decoded.zip}`
      : "Property research",
    description:
      "Florida property permit research result. Progressive coverage with honest empty states.",
    path: `/property/${id}`,
    noIndex: true,
  });
}

export default async function PropertyByIdPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const decoded = decodePropertyId(decodeURIComponent(id));

  if (!decoded) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Could not open property</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Invalid property id. Enter the address again.
        </p>
        <Link href="/property" className="mt-4 inline-block text-sm font-semibold text-[var(--navy)]">
          ← Check my address
        </Link>
      </main>
    );
  }

  const result = researchProperty({
    street: decoded.street,
    unit: decoded.unit || sp.unit,
    zip: decoded.zip,
    city: sp.city || undefined,
    state: "FL",
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/property"
        className="text-sm text-[var(--muted)] no-underline hover:text-[var(--text)]"
      >
        ← New address
      </Link>
      <div className="mt-4">
        <PropertyResultView result={result} />
      </div>
    </main>
  );
}
