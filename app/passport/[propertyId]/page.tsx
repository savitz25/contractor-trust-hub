import type { Metadata } from "next";
import { PassportDetailClient } from "@/components/passport/PassportDetailClient";
import { pageMetadata } from "@/lib/seo/page-meta";

type Props = { params: Promise<{ propertyId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { propertyId } = await params;
  return pageMetadata({
    title: "Home Passport property",
    description: "Long-term property improvement and warranty records.",
    path: `/passport/${propertyId}`,
    noIndex: true,
  });
}

export default async function PassportDetailPage({ params }: Props) {
  const { propertyId } = await params;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <PassportDetailClient passportId={decodeURIComponent(propertyId)} />
    </main>
  );
}
