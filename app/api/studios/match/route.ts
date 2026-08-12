import { NextResponse } from "next/server";
import { matchContractorsForPlan } from "@/lib/plan/matching";
import {
  buildStudioContext,
  studioCostRange,
} from "@/lib/studios/context";
import { getStudioBySlug } from "@/lib/studios/registry";
import type { StudioAnswers } from "@/lib/studios/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { answers?: StudioAnswers };
  try {
    body = (await request.json()) as { answers?: StudioAnswers };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const answers = body.answers;
  if (!answers?.studioSlug) {
    return NextResponse.json({ error: "answers.studioSlug required." }, { status: 400 });
  }

  const studio = getStudioBySlug(answers.studioSlug);
  if (!studio) {
    return NextResponse.json({ error: "Unknown studio." }, { status: 404 });
  }

  const ctx = buildStudioContext(studio, answers);
  const cost = studioCostRange(studio, answers);
  const match = await matchContractorsForPlan(
    {
      projectType: ctx.projectType,
      scale: ctx.scale,
      state: ctx.location.state,
      zip: ctx.location.zip,
      city: ctx.location.city,
      county: ctx.location.county,
      budgetBand: answers.budgetBand,
      details: answers.details,
    },
    {
      primaryOccupationCodes: studio.primaryOccupationCodes,
      secondaryOccupationCodes: studio.secondaryOccupationCodes,
      strictMatching: studio.strictMatching,
      matchWhy: `${studio.shortName} studio: matching ${studio.primaryOccupationCodes.join("/")} first.`,
      minPrimaryResults: studio.strictMatching ? 3 : 4,
    }
  );

  return NextResponse.json({
    studio: {
      slug: studio.slug,
      name: studio.name,
      resultFraming: studio.resultFraming,
    },
    context: ctx,
    cost,
    match,
  });
}
