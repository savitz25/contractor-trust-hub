import { NextResponse } from "next/server";
import { getCostRange } from "@/lib/plan/cost-model";
import { matchContractorsForPlan } from "@/lib/plan/matching";
import { summarizePlan } from "@/lib/plan/plan-url";
import { isProjectTypeId } from "@/lib/plan/project-types";
import type { PlanInput, ScaleBand } from "@/lib/plan/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Partial<PlanInput>;
  try {
    body = (await request.json()) as Partial<PlanInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.projectType || !isProjectTypeId(body.projectType)) {
    return NextResponse.json({ error: "Valid projectType is required." }, { status: 400 });
  }

  const scale = (body.scale || "medium") as ScaleBand;
  const plan: PlanInput = {
    projectType: body.projectType,
    scale: ["small", "medium", "large"].includes(scale) ? scale : "medium",
    state: (body.state || "FL").toUpperCase(),
    zip: body.zip,
    city: body.city,
    county: body.county,
    budgetBand: body.budgetBand ?? null,
    details: body.details?.slice(0, 1000),
  };

  const cost = getCostRange(plan.projectType, plan.scale, plan.state);
  const match = await matchContractorsForPlan(plan);
  const summary = summarizePlan(plan);

  return NextResponse.json({
    plan,
    summary,
    cost,
    match,
  });
}
