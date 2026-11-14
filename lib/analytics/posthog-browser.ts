"use client";

import type { CaptureResult, PostHog } from "posthog-js";
import { analyticsEnvironment, posthogHost, posthogKey, shouldEnablePosthog } from "./environment";
import { createPosthogClientGate } from "./posthog-gate";
import {
  isReplayEvent,
  sanitizeCapturedNetworkRequest,
  sanitizeCaptureResult,
  suppressExceptionCapture,
} from "./privacy";
import { CONTRACTOR_HUB } from "./events";

function sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
  // Session replay is disabled for this hub. Drop any replay payload outright as
  // defense in depth (e.g. if a project-level setting tries to turn it back on).
  if (event && isReplayEvent(event.event)) return null;
  const kept = suppressExceptionCapture(event);
  if (!kept) return null;
  return sanitizeCaptureResult(kept);
}

async function loadPosthog(): Promise<PostHog | null> {
  const key = posthogKey();
  if (!key) return null;
  const posthog = (await import("posthog-js")).default;
  posthog.init(key, {
    api_host: posthogHost(),
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: false,
    respect_dnt: true,
    persistence: "localStorage+cookie",
    // Privacy: replay DOM snapshots can carry search text echoed into result pages,
    // recent-research buttons and query-bearing links, so session replay is off for
    // this hub regardless of the shared project setting. Heatmaps and dead-click
    // capture are off for the same reason (they key data by page URL / element).
    disable_session_recording: true,
    enable_heatmaps: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    // Autocapture never collects element text (button/link labels can echo a query).
    mask_all_text: true,
    autocapture: {
      capture_copied_text: false,
      capture_value_css_selector_allowlist: [],
      element_allowlist: ["a", "button"],
    },
    before_send: (event) => sanitizeEvent(event),
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
        text: true,
        search: true,
        tel: true,
        url: true,
        textarea: true,
        select: true,
        number: true,
      },
      // Only relevant if replay is ever re-enabled in code: mask every text node.
      maskTextSelector: "*",
      maskCapturedNetworkRequestFn: (request) => sanitizeCapturedNetworkRequest(request),
    },
    loaded: (instance) => {
      instance.register({
        hub: CONTRACTOR_HUB,
        environment: analyticsEnvironment(),
      });
    },
  });
  return posthog;
}

const gate = createPosthogClientGate<PostHog>(loadPosthog);

export async function getPosthogBrowser(): Promise<PostHog | null> {
  try {
    if (typeof window === "undefined") return null;
    if (!shouldEnablePosthog()) return null;
    return await gate.get();
  } catch {
    return null;
  }
}
