export type AnalyticsEnvironment = "production" | "preview" | "development";

const ENVIRONMENTS = new Set<AnalyticsEnvironment>(["production", "preview", "development"]);

let boundEnvironment: AnalyticsEnvironment | null = null;

/** Server layout passes `VERCEL_ENV` into the client. The browser bundle does not inline `VERCEL_ENV`. */
export function bindAnalyticsEnvironment(environment: AnalyticsEnvironment): void {
  if (ENVIRONMENTS.has(environment)) boundEnvironment = environment;
}

export function analyticsEnvironment(): AnalyticsEnvironment {
  if (boundEnvironment) return boundEnvironment;
  const vercel = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercel === "production" || vercel === "preview" || vercel === "development") return vercel;
  return "development";
}

export function posthogKey(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim();
}

export function posthogHost(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST || "").trim() || "https://us.i.posthog.com";
}

/** Development stays silent unless this public flag is `1`, `true`, or `yes`. */
export function posthogDebugEnabled(): boolean {
  const flag = (process.env.NEXT_PUBLIC_POSTHOG_DEBUG || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** Browser Do Not Track, or cookies turned off, opts out of product analytics. */
export function analyticsBrowserOptOut(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    const dnt = navigator.doNotTrack;
    if (dnt === "1" || dnt === "yes") return true;
    return navigator.cookieEnabled === false;
  } catch {
    return false;
  }
}

export function shouldEnablePosthog(): boolean {
  try {
    if (!posthogKey()) return false;
    if (analyticsEnvironment() === "development" && !posthogDebugEnabled()) return false;
    if (typeof window !== "undefined" && window.navigator?.webdriver) return false;
    if (analyticsBrowserOptOut()) return false;
    return true;
  } catch {
    return false;
  }
}
