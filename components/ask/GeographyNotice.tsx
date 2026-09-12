import React from "react";
import Link from "next/link";
import { askHref, type AskUrlOverrides } from "@/lib/ask/url";
import { stateName, type GeographyRequirement } from "@/lib/ask/geography";
export function GeographyNotice({
  requirement: r,
  query,
  overrides = {},
  route = "/ask",
}: {
  requirement: GeographyRequirement | null | undefined;
  query: string;
  overrides?: AskUrlOverrides;
  route?: "/ask" | "/search";
}) {
  if (!r) return null;
  const href = (action: string, choice: string) =>
    askHref(query, {
      ...overrides,
      geo: undefined,
      geoAction: action,
      geoChoice: choice,
      geoCorrection:r.acceptedCorrection?r.correction?.id:undefined,
      page: "1",
    }).replace(/^\/ask/, route);
  const executed = r.executionGeography;
  return (
    <section
      aria-label="Requested and executed geography"
      className="rounded-2xl border border-[var(--border)] bg-white p-5"
    >
      <h2 className="text-lg font-semibold">
        {r.resolution === "CORRECTION_SUGGESTED" && !r.acceptedCorrection
          ? "Confirm the county"
          : "Your requested place"}
      </h2>
      <p className="mt-2">
        <strong>You asked for:</strong> {r.normalizedPlace}
      </p>
      <p className="mt-2">
        <strong>{executed ? "Applied geography:" : "Local scope:"}</strong>{" "}
        {executed
          ? [
              executed.city,
              executed.county ? `${executed.county} County` : null,
              stateName(executed.state),
            ]
              .filter(Boolean)
              .join(", ")
          : "Not executed"}
      </p>
      <p className="mt-2 text-sm">{r.message}</p>
      {executed ? <p className="mt-2 text-sm">{executed.meaning}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {r.correction && !r.acceptedCorrection ? (
          <Link
              prefetch={false}
            className="rounded-xl border px-4 py-3 font-semibold focus-visible:outline-2"
            href={href("correct", r.correction.id)}
          >
            Apply {r.correction.county} County
          </Link>
        ) : null}
        {r.canBroaden &&
        r.requestedState &&
        r.executionOutcome !== "USER_APPROVED_RELAXATION" ? (
          <Link
              prefetch={false}
            className="rounded-xl border px-4 py-3 font-semibold focus-visible:outline-2"
            href={href("broaden", r.requestedState.toLowerCase())}
          >
            Research {stateName(r.requestedState)} statewide instead
          </Link>
        ) : null}
        {r.officialHref ? (
          <a
            className="rounded-xl border px-4 py-3 font-semibold"
            href={r.officialHref}
          >
            Check the requested credential with TDLR
          </a>
        ) : null}
      </div>
      {r.requestedState === "TX" ? (
        <p className="mt-3 text-sm">
          Texas A/C status is derived from indexed expiration dates; confirm
          with{" "}
          <a
            className="underline"
            href="https://www.tdlr.texas.gov/LicenseSearch/"
          >
            TDLR
          </a>
          .{" "}
          <Link prefetch={false} className="underline" href="/texas">
            Texas intelligence
          </Link>{" "}
          is a separate source overview.
        </p>
      ) : null}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Geography Trace
        </summary>
        <dl className="mt-2 grid gap-2">
          <div>
            <dt>Original place</dt>
            <dd>{r.rawPlace}</dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>
              {r.resolution}
              {r.acceptedCorrection ? " - correction accepted" : ""}
            </dd>
          </div>
          <div>
            <dt>Execution outcome</dt>
            <dd>{r.executionOutcome}</dd>
          </div>
          <div>
            <dt>Source / meaning</dt>
            <dd>
              {r.source ?? "No source query authorized"};{" "}
              {executed?.meaning ?? "No geographic match claimed"}
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
