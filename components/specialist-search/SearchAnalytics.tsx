"use client";

import { useEffect } from "react";
import type { SpecialistSearchDimensions } from "@/lib/specialist-search/analytics";
import type { SpecialistSearchEvent } from "@/lib/specialist-search/analytics";

function emit(event: SpecialistSearchEvent, dimensions: SpecialistSearchDimensions) {
  const detail = { event, ...dimensions };
  window.dispatchEvent(new CustomEvent("specialist-search", { detail }));
  const target = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  target.dataLayer?.push(detail);
}

export function SearchAnalytics({ dimensions, hasResults }: { dimensions: SpecialistSearchDimensions; hasResults: boolean }) {
  useEffect(() => {
    emit("specialist_search_interpreted", dimensions);
    emit(hasResults ? "specialist_search_results" : "specialist_search_zero_results", dimensions);
    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest("a, summary") : null;
      if (!element) return;
      if (element.textContent?.includes("Trace this result")) emit("specialist_search_trace_open", dimensions);
      if (element.textContent?.includes("Research this contractor")) emit("specialist_search_profile_open", dimensions);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [dimensions, hasResults]);
  return null;
}
