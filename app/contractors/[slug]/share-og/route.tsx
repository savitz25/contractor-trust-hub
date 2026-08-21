import { getContractorBySlug } from "@/lib/contractors/queries";
import {
  contractorFallbackPng,
  renderContractorCardOrFallback,
  shareOgHead,
} from "@/lib/og/contractor-share-og";
import { contractorEntityShareModel } from "@/lib/seo/share-card-model";
import { occupationLabel } from "@/lib/states/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const contractor = await getContractorBySlug(decodeURIComponent(String(slug ?? "").trim()));
    if (!contractor?.displayName) return contractorFallbackPng();

    const lic = contractor.licenses[0];
    return renderContractorCardOrFallback(
      contractorEntityShareModel({
        name: contractor.displayName,
        city: contractor.primaryCity,
        county: contractor.primaryCounty,
        state: contractor.homeState,
        tradeLabel: lic ? occupationLabel(lic.occupationCode) : null,
      }),
    );
  } catch {
    return contractorFallbackPng();
  }
}

export function HEAD() {
  return shareOgHead();
}
