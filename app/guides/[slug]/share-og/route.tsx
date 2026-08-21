import {
  contractorFallbackPng,
  renderContractorCardOrFallback,
  resolveContractorGuideCard,
  shareOgHead,
} from "@/lib/og/contractor-share-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    return renderContractorCardOrFallback(resolveContractorGuideCard(String(slug ?? "").trim()));
  } catch {
    return contractorFallbackPng();
  }
}

export function HEAD() {
  return shareOgHead();
}
