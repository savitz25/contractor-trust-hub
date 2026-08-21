import { makeDiscoveryShareOgGet, shareOgHead } from "@/lib/og/contractor-share-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = makeDiscoveryShareOgGet("florida", "florida-city-trade");
export function HEAD() {
  return shareOgHead();
}
