import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getProjectType, isProjectTypeId } from "@/lib/plan/project-types";
import type { BudgetBand, ProjectTypeId, ScaleBand } from "@/lib/plan/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  projectType?: string;
  location?: string;
  state?: string;
  zip?: string;
  city?: string;
  county?: string;
  scale?: string;
  budgetBand?: string | null;
  details?: string;
  notes?: string;
  costLow?: number;
  costMid?: number;
  costHigh?: number;
  contractorSlugs?: string[];
};

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();

  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!validEmail(email)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (phone.length < 7) {
    return NextResponse.json({ error: "Phone is required." }, { status: 400 });
  }
  if (!body.projectType || !isProjectTypeId(body.projectType)) {
    return NextResponse.json({ error: "Valid project type is required." }, { status: 400 });
  }

  const projectType = body.projectType as ProjectTypeId;
  const def = getProjectType(projectType);
  const scale = (body.scale || "medium") as ScaleBand;
  const scaleLabel = def.scaleLabels[scale] || scale;
  const location =
    (body.location || "").trim() ||
    [body.city, body.county, body.zip, body.state || "FL"].filter(Boolean).join(", ");

  const context = {
    projectType,
    projectLabel: def.label,
    scale,
    scaleLabel,
    budgetBand: body.budgetBand as BudgetBand | null,
    details: body.details?.slice(0, 1000) || null,
    notes: body.notes?.slice(0, 2000) || null,
    location,
    cost: {
      low: body.costLow ?? null,
      mid: body.costMid ?? null,
      high: body.costHigh ?? null,
    },
    contractorSlugs: body.contractorSlugs?.slice(0, 20) || [],
  };

  let id: string | null = null;
  try {
    const rows = await query<{ id: string }>(
      `
      INSERT INTO plan_quote_requests (
        name, email, phone,
        project_type, project_label, location_label,
        state, zip, city, county,
        scale_band, scale_label, budget_band,
        details, notes,
        cost_low, cost_mid, cost_high,
        contractor_slugs, project_context
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15,
        $16, $17, $18,
        $19, $20::jsonb
      )
      RETURNING id
      `,
      [
        name,
        email,
        phone,
        projectType,
        def.label,
        location,
        (body.state || "FL").toUpperCase().slice(0, 2),
        body.zip || null,
        body.city || null,
        body.county || null,
        scale,
        scaleLabel,
        body.budgetBand || null,
        body.details?.slice(0, 1000) || null,
        body.notes?.slice(0, 2000) || null,
        body.costLow ?? null,
        body.costMid ?? null,
        body.costHigh ?? null,
        body.contractorSlugs?.slice(0, 20) || null,
        JSON.stringify(context),
      ]
    );
    id = rows[0]?.id ?? null;
  } catch (e) {
    // Table may not exist yet — log and still accept with webhook if configured
    console.error("[plan/quote-request] db insert failed", e);
  }

  const webhook = process.env.PLAN_QUOTE_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "plan_quote_request",
          id,
          ...context,
          contact: { name, email, phone },
        }),
      });
    } catch (e) {
      console.error("[plan/quote-request] webhook failed", e);
    }
  }

  // Always acknowledge if contact data was valid — controlled intro, not contractor spam
  return NextResponse.json({
    ok: true,
    id,
    message:
      "Request received. A team member will review and facilitate introductions to verified contractors — we do not auto-blast your info.",
  });
}
