"use client";
import { useEffect } from "react";
import React from "react";

export function BusinessProfileAnalytics({ profileId, freshness }: { profileId: string; freshness: string }) {
  useEffect(() => {
    for (const event of ["business_info_public_view", "managed_profile_indicator_view"]) {
      const payload = { event, hub: "contractor", native_profile_id: profileId, state: "FL", source_system: "fl_dbpr", freshness };
      try {
        const w = window as unknown as { gtag?: (...args: unknown[]) => void; dataLayer?: Array<Record<string, unknown>> };
        w.gtag?.("event", event, payload); w.dataLayer?.push(payload);
      } catch { /* analytics cannot affect the profile */ }
    }
  }, [profileId, freshness]);
  return null;
}
