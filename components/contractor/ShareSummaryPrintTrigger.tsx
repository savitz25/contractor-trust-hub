"use client";

import { useEffect } from "react";

/** Auto-open the browser print dialog when the summary is opened with ?print=1 */
export function ShareSummaryPrintTrigger({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => {
      window.print();
    }, 400);
    return () => window.clearTimeout(t);
  }, [enabled]);
  return null;
}
