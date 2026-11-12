"use client";

import React, { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { bindAnalyticsEnvironment, shouldEnablePosthog, type AnalyticsEnvironment } from "@/lib/analytics/environment";
import { getPosthogBrowser } from "@/lib/analytics/posthog-browser";
import { captureSanitizedPageview } from "@/lib/analytics/trusthub";

function PosthogPageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!shouldEnablePosthog()) return;
    const path = pathname || "/";
    void getPosthogBrowser()
      .then((posthog) => {
        if (!posthog) return;
        captureSanitizedPageview(path, window.location.href);
      })
      .catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}

export function PosthogRoot({ environment }: { environment: AnalyticsEnvironment }) {
  bindAnalyticsEnvironment(environment);
  useEffect(() => {
    void getPosthogBrowser().catch(() => undefined);
  }, []);
  return (
    <Suspense fallback={null}>
      <PosthogPageviews />
    </Suspense>
  );
}
