"use client";

import type { CaptureResult, PostHog } from "posthog-js";
import { analyticsEnvironment, posthogHost, posthogKey, shouldEnablePosthog } from "./environment";
import { createPosthogClientGate } from "./posthog-gate";
import { sanitizeCapturedNetworkRequest, sanitizeCaptureResult } from "./privacy";
import { CONTRACTOR_HUB } from "./events";

function sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
  return sanitizeCaptureResult(event);
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
    persistence: "localStorage+cookie",
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
      maskTextSelector: "input, textarea, select, [contenteditable], [data-ph-mask]",
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
