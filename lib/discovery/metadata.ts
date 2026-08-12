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
}): Metadata {
  const path = discoveryPath(opts.state, {
    countySlug: opts.county?.slug,
    tradeSlug: opts.trade?.slug,
  });
  return pageMetadata({
    title: opts.title,
    description: opts.description,
    path,
  });
}
