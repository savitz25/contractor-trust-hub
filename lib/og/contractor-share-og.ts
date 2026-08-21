import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { cityLabelFromSlug } from "@/lib/discovery/browse";
import {
  getCounty,
  getDiscoveryState,
  getTrade,
} from "@/lib/discovery/config";
import { getGuideBySlug } from "@/lib/guides/registry";
import { renderContractorShareImage } from "@/lib/og/contractor-share-card";
import {
  contractorGuideShareModel,
  contractorPlaceShareModel,
  contractorPlaceTradeShareModel,
  contractorStateShareModel,
  contractorTradeShareModel,
  type ContractorShareCardModel,
} from "@/lib/seo/share-card-model";

const PNG_PATH = join(process.cwd(), "public/brand/contractor-trust-hub-og.png");
const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

export function contractorFallbackPng(): NextResponse {
  const buf = readFileSync(PNG_PATH);
  return new NextResponse(buf, { status: 200, headers: PNG_HEADERS });
}

export function shareOgHead(): NextResponse {
  return new NextResponse(null, { status: 200, headers: { "Content-Type": "image/png" } });
}

export function renderContractorCardOrFallback(model: ContractorShareCardModel | null) {
  if (!model) return contractorFallbackPng();
  try {
    return renderContractorShareImage(model);
  } catch {
    return contractorFallbackPng();
  }
}

function isCountyPlace(stateSlug: string, placeSlug: string): boolean {
  const state = getDiscoveryState(stateSlug);
  return Boolean(state?.counties.some((c) => c.slug === placeSlug));
}

export function resolveContractorContentCard(input: {
  stateSlug: string;
  segment?: string;
  facet?: string;
  trade?: string;
}): ContractorShareCardModel | null {
  const state = getDiscoveryState(input.stateSlug);
  if (!state) return null;

  const segment = (input.segment || "").trim();
  const facet = (input.facet || "").trim();
  const tradeSlug = (input.trade || "").trim();

  if (!segment) return contractorStateShareModel(state.name);

  const place = getCounty(state, segment);
  const tradeAtSegment = getTrade(state, segment);

  if (!facet && !tradeSlug) {
    if (place) {
      return contractorPlaceShareModel({
        placeName: place.name,
        stateName: state.name,
        isCounty: isCountyPlace(state.publicSlug, place.slug),
      });
    }
    if (tradeAtSegment) {
      return contractorTradeShareModel({
        tradeTitle: tradeAtSegment.title,
        stateName: state.name,
      });
    }
    return null;
  }

  if (!place) return null;

  if (tradeSlug) {
    const trade = getTrade(state, tradeSlug);
    if (!trade) return null;
    const city = cityLabelFromSlug(facet);
    return contractorPlaceTradeShareModel({
      tradeTitle: trade.title,
      placeName: city || place.name,
      stateName: state.name,
    });
  }

  const trade = getTrade(state, facet);
  if (!trade) return null;
  const placeName = isCountyPlace(state.publicSlug, place.slug)
    ? /county$/i.test(place.name)
      ? place.name
      : `${place.name} County`
    : place.name;
  return contractorPlaceTradeShareModel({
    tradeTitle: trade.title,
    placeName,
    stateName: state.name,
  });
}

export function resolveContractorGuideCard(slug: string): ContractorShareCardModel | null {
  const guide = getGuideBySlug(slug);
  if (!guide) return null;
  return contractorGuideShareModel({ title: guide.title, kicker: guide.kicker });
}

export function makeDiscoveryShareOgGet(
  stateSlug: string,
  depth: "state" | "segment" | "facet" | "florida-city-trade",
) {
  return async function GET(
    _request: Request,
    context: { params: Promise<Record<string, string>> },
  ) {
    try {
      const params = await context.params;
      const model = resolveContractorContentCard({
        stateSlug,
        segment: depth === "state" ? undefined : params.segment,
        facet: depth === "facet" || depth === "florida-city-trade" ? params.facet : undefined,
        trade: depth === "florida-city-trade" ? params.trade : undefined,
      });
      return renderContractorCardOrFallback(model);
    } catch {
      return contractorFallbackPng();
    }
  };
}
