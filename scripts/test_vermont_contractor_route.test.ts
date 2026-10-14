import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/vermont/page.tsx", "utf8");

test("Vermont contractor page keeps residential registration and trade classes separate", () => {
  assert.match(page, /at least \$10,000/);
  assert.match(page, /NOT_ACQUIRED/);
  assert.match(
    page,
    /Current row-level OPR residential-contractor registrations/,
  );
  for (const licenseClass of [
    "Electrician",
    "Gas Installer",
    "Plumber",
    "Oil Installer",
    "Trade Qualified Person",
    "Elevator Tradesman",
    "Boiler Inspector",
    "Sprinkler Designer",
  ]) {
    assert.match(page, new RegExp(licenseClass));
  }
  assert.match(page, /11,520 raw rows/);
  assert.match(page, /No total across unlike\s+license\s+classes is published/);
  assert.match(page, /does not have a universal general-contractor license/);
});
