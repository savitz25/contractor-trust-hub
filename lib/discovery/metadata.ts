import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";
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
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: path },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: absoluteUrl(path),
      type: "website",
      siteName: "Contractor Trust Hub",
    },
    twitter: {
      card: "summary",
      title: opts.title,
      description: opts.description,
    },
    robots: { index: true, follow: true },
  };
}
