import assert from "node:assert/strict";
import test from "node:test";
import { interpretGeorgiaSos } from "../ask/georgia-sos.ts";
import { GA_CEASE_AND_DESIST, GA_CREDENTIAL_CLASSES } from "./snapshot.ts";

test("GA-CON-001 credential classes stay distinct and uncounted", () => {
  const labels = GA_CREDENTIAL_CLASSES.map((row) => row.label);
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(GA_CREDENTIAL_CLASSES.every((row) => row.coverage === "NOT_ACQUIRED"), true);
});

test("GA-CON-001 cease-and-desist rows are not license joins", () => {
  assert.ok(GA_CEASE_AND_DESIST.length >= 30);
  for (const row of GA_CEASE_AND_DESIST) {
    assert.equal(row.licenseNumber, null);
    assert.equal(row.attribution, "name_and_place_only_not_joined");
    assert.equal(row.orderDate, null);
  }
});

test("GA-CON-001 search does not invent a licensee census", () => {
  const license = interpretGeorgiaSos("residential contractor in Georgia", "residential contractor in georgia");
  assert.equal(license?.count, null);
  assert.match(license?.failMessage ?? "", /not in this hub/i);
  const orders = interpretGeorgiaSos("Georgia cease and desist", "georgia cease and desist");
  assert.equal(orders?.count?.value, GA_CEASE_AND_DESIST.length);
  assert.match(orders?.count?.grain ?? "", /cease-and-desist/);
  assert.match(orders?.changeHints?.[0] ?? "", /not licensed contractors/i);
});
