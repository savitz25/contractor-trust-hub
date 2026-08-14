import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import type { CountyDef, DiscoveryStateConfig, TradeDef } from "./types";
import { discoveryPath } from "./config";

export function discoveryMetadata(opts: {
  state: DiscoveryStateConfig;
  county?: CountyDef | null;
  trade?: TradeDef | null;
  title: string;
  description: string;
  /** Pagination and empty utility views should not compete with page 1. */
  noIndex?: boolean;
}): Metadata {
  const path = discoveryPath(opts.state, {
    countySlug: opts.county?.slug,
    tradeSlug: opts.trade?.slug,
  });
  return pageMetadata({
    title: opts.title,
    description: opts.description,
    path,
    noIndex: opts.noIndex,
  });
}
