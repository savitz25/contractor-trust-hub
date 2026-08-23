import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parseContractorAskHandoff } from "@/lib/ask-handoff/parse";
import { resolveContractorAskHandoff } from "@/lib/ask-handoff/resolve";

export const metadata: Metadata = {
  title: "Ask handoff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FromAskHandoffPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = parseContractorAskHandoff(params);
  if (!ctx) redirect("/florida");
  const dest = resolveContractorAskHandoff(ctx);
  redirect(dest.href);
}
