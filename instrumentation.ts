import { reportRequestError, sentryDsn } from "./lib/observability/sentry";

/**
 * Server and edge only. There is no instrumentation-client file, so the
 * browser bundle does not include Sentry.
 */
export async function register(): Promise<void> {
  if (!sentryDsn()) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  },
): Promise<void> {
  reportRequestError(error, request, context);
}
