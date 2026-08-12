import { NextResponse } from "next/server";
import { researchProperty } from "@/lib/property/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    street?: string;
    unit?: string;
    city?: string;
    zip?: string;
    state?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.street || !body.zip) {
    return NextResponse.json({ error: "street and zip required." }, { status: 400 });
  }

  const result = researchProperty({
    street: body.street,
    unit: body.unit,
    city: body.city,
    zip: body.zip,
    state: body.state || "FL",
  });

  return NextResponse.json({ result });
}
