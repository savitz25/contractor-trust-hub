"use client";

import React, { useEffect, useRef } from "react";
import { captureSearchResultsReturned } from "@/lib/analytics/trusthub";

export function SearchResultsReturned({
  occurrence,
  surface,
  resultCount,
  success,
  state,
  capabilityState,
}: {
  /** Per-request id used only to fire once. It is not sent to PostHog. */
  occurrence: string;
  surface: string;
  resultCount: number;
  success: boolean;
  state?: string | null;
  capabilityState?: string | null;
}) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === occurrence) return;
    sent.current = occurrence;
    captureSearchResultsReturned({ surface, resultCount, success, state, capabilityState });
  }, [occurrence, surface, resultCount, success, state, capabilityState]);
  return null;
}
