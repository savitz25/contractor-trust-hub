import assert from "node:assert/strict";
import test from "node:test";
import { interpretMaryland } from "../lib/ask/maryland";
import { interpretAskQuery } from "../lib/ask/interpret";

test("Maryland statewide and city-context routes", () => {
  for (const q of ["contractor Maryland", "home improvement contractor Maryland", "MHIC contractor", "Maryland contractor license", "contractor discipline Maryland", "MHIC disciplinary action", "Guaranty Fund Maryland contractor", "contractor complaints Maryland", "electrical contractor Maryland", "plumber Maryland", "HVAC contractor Maryland", "contractor Baltimore", "contractor Annapolis", "contractor Frederick", "contractor Rockville"]) {
    assert.match(interpretMaryland(q)?.href ?? "", /^\/maryland/, q);
  }
});

test("MHIC labeled number has priority; bare digits are ambiguous", () => {
  const exact = interpretMaryland("MHIC license 01-81816-01 Maryland contractor");
  assert.equal(exact?.interpretation.identifier, "01-81816-01");
  assert.match(exact?.href ?? "", /license=01-81816-01/);
  const bare = interpretMaryland("81816 Maryland contractor");
  assert.equal(bare?.interpretation.identifier, null);
  assert.match(bare?.definition?.body ?? "", /bare number is ambiguous/i);
  assert.equal(interpretMaryland("81816"), null);
});

test("ranking requests fail closed before Maryland routing", () => {
  for (const q of ["best Maryland contractor", "safest MHIC contractor", "recommended Maryland contractor", "top-rated Maryland contractor", "highest-rated Maryland contractor", "#1 Maryland contractor", "most trustworthy Maryland contractor", "Trust Score Maryland contractor", "AggregateRating Maryland contractor", "ratingValue Maryland contractor", "paid ranking Maryland contractor", "sponsored ranking Maryland contractor"]) {
    assert.equal(interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]).mode, "fail_closed", q);
  }
});
