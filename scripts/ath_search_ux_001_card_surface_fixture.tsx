/**
 * ATH-SEARCH-UX-001 / D1 browser fixture. Prints one HTML page built from the real AskResultCard markup,
 * the real app/globals.css and the real lib/ask/card-surface.ts handler, bound the way the client component
 * binds it. Run by e2e/ath-search-ux-001-card-surface.spec.tsx through tsx; never served by the app.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { AskResultCard } from "../components/ask/AskResultCard";
import { formatLicenseAddress } from "../lib/ask/recorded-address-display";
import type { AskEntityCard } from "../lib/ask/execute";

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), "..");
export const FIXTURE_ORIGIN = "http://ath-search-ux-001.fixture";
export const PROFILE_A = "/contractors/cac1813307-snyder-co";
export const PROFILE_B = "/contractors/cac1815743-snyder-air-conditioning-plumbing-electric-llc";

function card(partial: Partial<AskEntityCard> & Pick<AskEntityCard, "contractorId" | "displayName" | "profileHref" | "slug">): AskEntityCard {
  return {
    credentialKey: "1813307",
    occupationCode: "CAC",
    occupationLabel: "Certified Air Conditioning Contractor",
    statusNormalized: "current",
    statusLabel: "C in indexed Florida record",
    city: "JACKSONVILLE",
    county: "Duval",
    state: "FL",
    sourceLabel: "Florida DBPR — Construction Industry Licensing Board",
    sourceSystem: "fl_dbpr",
    geographyNote: "Recorded address on the profile. Separate from the credential jurisdiction; not service territory or current availability.",
    evidenceCount: 0,
    newestEvidenceDate: null,
    whyMatched: "The public display name equals the supplied name after case, punctuation, apostrophe and legal-suffix normalization. Matched on the public display name: “SNYDER CO.”.",
    evidence: [],
    credentialJurisdictionLabel: "Florida · Florida DBPR — Construction Industry Licensing Board",
    matchedOn: { field: "display_name", value: "SNYDER CO.", method: "NORMALIZED_NAME" },
    publicAddress: { status: "loaded", ...formatLicenseAddress({ street: "6831 POTTSBURG DRIVE", city: "JACKSONVILLE", state: "FL", postalCode: "32216", county: "Duval" }) },
    ...partial,
  } as AskEntityCard;
}

const CARDS: AskEntityCard[] = [
  card({ contractorId: "a", slug: "cac1813307-snyder-co", displayName: "SNYDER CO.", profileHref: PROFILE_A }),
  card({
    contractorId: "b",
    slug: "cac1815743-snyder-air-conditioning-plumbing-electric-llc",
    displayName: "SNYDER AIR CONDITIONING, PLUMBING & ELECTRIC, LLC",
    profileHref: PROFILE_B,
    credentialKey: "1815743",
    city: "BOCA RATON",
    county: "Palm Beach",
    publicAddress: { status: "loaded", ...formatLicenseAddress({ street: "1265 SW 4TH CT", city: "BOCA RATON", state: "FL", postalCode: "33432", county: "Palm Beach" }) },
  }),
  card({ contractorId: "c", slug: "", displayName: "Research only row", profileHref: null, matchedOn: null, whyMatched: "Indexed record without a public profile." }),
];

export function fixtureHtml(): string {
  const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8").replace(/^@import[^\n]*\n/gm, "");
  const source = readFileSync(path.join(ROOT, "lib/ask/card-surface.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  const items = CARDS.map((row) => `<li>${renderToStaticMarkup(<AskResultCard card={row} />)}</li>`).join("");
  return [
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<base href="${FIXTURE_ORIGIN}/"><title>ATH-SEARCH-UX-001 card surface fixture</title><style>${css}</style></head>`,
    `<body><main style="padding:24px;max-width:960px;margin:0 auto"><ul style="list-style:none;padding:0;margin:0;display:grid;gap:16px">${items}</ul>`,
    `<div style="height:1800px"></div></main>`,
    `<script>var exports = {}; var module = { exports: exports };\n${js}\nwindow.__cardSurfacesBound = exports.bindCardSurfaces(document);</script></body></html>`,
  ].join("");
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  process.stdout.write(fixtureHtml());
}
