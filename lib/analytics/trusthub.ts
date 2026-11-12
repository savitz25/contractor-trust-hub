"use client";

import { analyticsEnvironment, shouldEnablePosthog } from "./environment";
import { CONTRACTOR_HUB, TRUSTHUB_EVENTS, type TrustHubEventName, type TrustHubEventProperties } from "./events";
import { getPosthogBrowser } from "./posthog-browser";
import { safeSlug, sanitizeAnalyticsUrl, stateCode, stripForbiddenProperties } from "./privacy";

export type TrustHubCaptureOptions = {
  /** Beacon the event before a GET navigation or form POST leaves the page. */
  sendBeforeUnload?: boolean;
};

export function captureTrustEvent(
  event: TrustHubEventName | string,
  properties?: Partial<TrustHubEventProperties>,
  options?: TrustHubCaptureOptions,
): void {
  try {
    if (!shouldEnablePosthog()) return;
    const payload = stripForbiddenProperties({
      hub: CONTRACTOR_HUB,
      environment: analyticsEnvironment(),
      ...properties,
    });
    void getPosthogBrowser()
      .then((posthog) => {
        if (!posthog) return;
        if (options?.sendBeforeUnload) {
          posthog.capture(event, payload, { send_instantly: true, transport: "sendBeacon" });
          return;
        }
        posthog.capture(event, payload);
      })
      .catch(() => undefined);
  } catch {
    // Observability must never break the product.
  }
}

let lastPageviewPath = "";

export function captureSanitizedPageview(pathname: string, href?: string): void {
  try {
    const path = sanitizeAnalyticsUrl(pathname.startsWith("/") ? pathname : `/${pathname}`)?.replace(/^https:\/\/www\.contractortrusthub\.com/, "") || pathname.split("?")[0] || "/";
    const bare = path.split("?")[0] || "/";
    if (lastPageviewPath === bare) return;
    lastPageviewPath = bare;
    captureTrustEvent(TRUSTHUB_EVENTS.PAGEVIEW, {
      surface: "app_router",
      $pathname: bare,
      $current_url: sanitizeAnalyticsUrl(href || pathname),
    });
  } catch {
    // ignore
  }
}

export function captureSearchSubmitted(surface: string, state?: string | null): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.SEARCH_SUBMITTED,
    { surface, state: stateCode(state), success: true },
    { sendBeforeUnload: true },
  );
}

export function captureSearchResultsReturned(properties: {
  surface: string;
  resultCount: number;
  success: boolean;
  state?: string | null;
  capabilityState?: string | null;
}): void {
  captureTrustEvent(TRUSTHUB_EVENTS.SEARCH_RESULTS_RETURNED, {
    surface: properties.surface,
    result_count: Number.isFinite(properties.resultCount) ? properties.resultCount : 0,
    success: properties.success,
    state: stateCode(properties.state),
    capability_state: properties.capabilityState || undefined,
  });
}

export function captureSearchResultOpened(surface: string, state?: string | null): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.SEARCH_RESULT_OPENED,
    { surface, state: stateCode(state), success: true },
    { sendBeforeUnload: true },
  );
}

export function captureSpecialistHandoff(specialistHub: string, surface: string): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.SPECIALIST_HANDOFF_STARTED,
    { surface, specialist_hub: specialistHub, success: true },
    { sendBeforeUnload: true },
  );
}

export function captureProfileViewed(slug: string, state?: string | null): void {
  captureTrustEvent(TRUSTHUB_EVENTS.PROFILE_VIEWED, {
    surface: "trust_report",
    slug: safeSlug(slug),
    state: stateCode(state),
    success: true,
  });
}

export function captureProfileSaved(slug: string): void {
  captureTrustEvent(TRUSTHUB_EVENTS.PROFILE_SAVED, {
    surface: "trust_report",
    slug: safeSlug(slug),
    success: true,
  });
}

export function captureProfileSaveFailed(slug: string): void {
  captureTrustEvent(TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED, {
    surface: "trust_report",
    slug: safeSlug(slug),
    success: false,
  });
}

export function captureProfileUnsaved(slug: string): void {
  captureTrustEvent(TRUSTHUB_EVENTS.PROFILE_UNSAVED, {
    surface: "trust_report",
    slug: safeSlug(slug),
    success: true,
  });
}

export function captureClaimStarted(state?: string | null): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.CLAIM_STARTED,
    { surface: "claim", state: stateCode(state), success: true },
    { sendBeforeUnload: true },
  );
}
