import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { shareRouteOgImage } from "@/lib/seo/share-hub";
import type { CountyDef, DiscoveryStateConfig, TradeDef } from "./types";
import { discoveryPath } from "./config";

export function discoveryMetadata(opts: {
  state: DiscoveryStateConfig;
  county?: CountyDef | null;
  trade?: TradeDef | null;
  citySlug?: string | null;
  title: string;
  description: string;
  /** Pagination and empty utility views should not compete with page 1. */
  noIndex?: boolean;
}): Metadata {
  const path = discoveryPath(opts.state, {
    countySlug: opts.county?.slug,
    citySlug: opts.citySlug || undefined,
    tradeSlug: opts.trade?.slug,
  });
  const og = shareRouteOgImage(path, opts.title);
  return pageMetadata({
    title: opts.title,
    description: opts.description,
    path,
    noIndex: opts.noIndex,
    images: [og.url],
    ogAlt: og.alt,
  });
}
