import { getOshaDetailPreviewFixture } from "@/data/preview/con-osha-001b-details";
import {
  buildPreviewOshaInspectionPage,
  buildUnmatchedPaginationDemoPage,
  OshaDetailUnavailableError,
} from "@/lib/osha/inspection-detail-adapter";
import { countKnownCitationItems } from "@/lib/osha/inspection-details";
import { oshaPreviewShowcaseAllowed } from "@/lib/osha/flag";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ sample: string }> };

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function GET(request: Request, { params }: Props) {
  if (!oshaPreviewShowcaseAllowed(process.env)) {
    return json({ error: "not_found" }, 404);
  }

  const { sample } = await params;
  const fixture = getOshaDetailPreviewFixture(sample);
  if (!fixture) return json({ error: "not_found" }, 404);
  if (fixture.id === "load-failure") {
    return json({ error: "temporarily_unavailable" }, 503);
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    const page = fixture.id === "pagination-demo"
      ? buildUnmatchedPaginationDemoPage({ inspections: fixture.inspections, cursor })
      : buildPreviewOshaInspectionPage({
          inspections: fixture.inspections,
          expectedCitationItems: fixture.aggregateCitationItems ?? -1,
          cursor,
        });

    if (
      page.reconciliation &&
      page.reconciliation.expectedCitationItems !== page.reconciliation.detailCitationItems
    ) {
      // Defensive assertion: buildPreviewOshaInspectionPage already fails closed.
      return json({ error: "details_unavailable" }, 409);
    }
    return json(page);
  } catch (error) {
    if (error instanceof OshaDetailUnavailableError && error.reason === "reconciliation_failed") {
      const actual = countKnownCitationItems(fixture.inspections);
      console.error("[osha] preview detail reconciliation failed", {
        fixtureId: fixture.id,
        expectedCitationItems: fixture.aggregateCitationItems,
        detailCitationItems: actual,
      });
      return json({ error: "details_unavailable" }, 409);
    }
    if (error instanceof OshaDetailUnavailableError && error.reason === "invalid_cursor") {
      return json({ error: "invalid_cursor" }, 400);
    }
    console.error("[osha] preview detail source unavailable", { fixtureId: fixture.id });
    return json({ error: "temporarily_unavailable" }, 503);
  }
}
