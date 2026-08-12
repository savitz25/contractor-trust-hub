import type { Metadata } from "next";
import { PassportListClient } from "@/components/passport/PassportListClient";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Home Passport — property records & warranties",
  description:
    "Long-term homeowner record of improvements, contractors, warranties, and documents. Not a title report or government registry.",
  path: "/passport",
});

export default function PassportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <PassportListClient />
    </main>
  );
}
