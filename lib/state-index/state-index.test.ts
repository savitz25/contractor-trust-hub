import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GeorgiaContractorPage from "../../app/georgia/page.tsx";
import { GEORGIA_INTELLIGENCE_GATE } from "../georgia-intelligence/publication.ts";
import { buildGeorgiaContractorJsonLd, gaJsonLdHasForbiddenRatings } from "../georgia-intelligence/jsonld.ts";
import { getStateIndex, stateIndexSource } from "./model.ts";

const SLUGS = [
  "alabama",
  "connecticut",
  "georgia",
  "massachusetts",
  "nevada",
  "ohio",
  "pennsylvania",
  "tennessee",
] as const;

const NEGATION = /\b(?:not|no|never|without|none|nor|n't)\b/gi;

function negationHits(text: string): number {
  return text.match(NEGATION)?.length ?? 0;
}

test("named state records come from counted sources", () => {
  for (const slug of SLUGS) {
    const source = stateIndexSource(slug);
    assert.ok(source, slug);
    assert.ok(source.rows.length >= 25, `${slug} sample`);
    assert.ok(source.total >= source.rows.length, `${slug} total`);
    const printed: Partial<Record<(typeof SLUGS)[number], number>> = {
      connecticut: 21046,
      massachusetts: 464,
      nevada: 19213,
      ohio: 4489,
      pennsylvania: 283,
      tennessee: 29096,
    };
    if (printed[slug] != null) assert.equal(source.total, printed[slug], slug);
    const model = getStateIndex(slug);
    assert.ok(model, slug);
    assert.ok(model.facts.length >= 2 && model.facts.length <= 4, `${slug} facts ${model.facts.length}`);
    for (const fact of model.facts) assert.equal(negationHits(fact), 0, fact);
    const words = model.about.trim().split(/\s+/).filter(Boolean).length;
    assert.ok(negationHits(model.about) * 100 <= words * 2, model.about);
    for (const record of source.rows) {
      assert.ok(record.name.trim().length > 1, slug);
      assert.equal(record.href, null);
    }
  }
});

test("Georgia server HTML names cease-and-desist respondents", () => {
  const html = renderToStaticMarkup(createElement(GeorgiaContractorPage));
  const heading = GEORGIA_INTELLIGENCE_GATE.title.replace(/ \| ContractorTrustHub$/, "");
  assert.match(html, new RegExp(`<h1[^>]*>${heading}</h1>`));
  assert.ok((html.match(/<h2\b/g) ?? []).length >= 6);
  assert.match(html, /<table/);
  assert.match(html, />Clifford Merritt</);
  assert.match(html, />Americus</);
  assert.ok((html.match(/Cease and desist/g) ?? []).length >= 25);
  assert.match(html, /About this data/);
  assert.match(html, /"@type":"WebPage"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /"@type":"Dataset"/);
  assert.equal(/aggregateRating|reviewRating|"ratingValue"/i.test(html), false);
  assert.equal(gaJsonLdHasForbiddenRatings(buildGeorgiaContractorJsonLd()), false);
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, " ");
  const words = visible.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean);
  assert.ok(negationHits(visible) * 100 <= words.length * 2, `georgia negation ${negationHits(visible)} / ${words.length}`);
});
