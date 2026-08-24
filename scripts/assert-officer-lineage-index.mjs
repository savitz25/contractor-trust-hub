import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../schema/migrations/009_entity_officer_lookup.sql", import.meta.url),
  "utf8"
);
const lineage = fs.readFileSync(
  new URL("../lib/contractors/entity-lineage.ts", import.meta.url),
  "utf8"
);
const section = fs.readFileSync(
  new URL("../components/contractor/EntityLineageSection.tsx", import.meta.url),
  "utf8"
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS entity_officer_lookup/);
assert.match(migration, /REFERENCES entities\(id\) ON DELETE CASCADE/);
assert.match(migration, /PRIMARY KEY \(entity_id, source_ordinal\)/);
assert.match(migration, /entity_officer_lookup \(officer_name_normalized, entity_id\)/);
assert.match(migration, /normalize_entity_officer_name/);
assert.match(migration, /AFTER UPDATE OF officers, source_system ON entities/);
assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE ON contractor_entities/);
assert.match(migration, /jsonb_array_elements/);
assert.doesNotMatch(migration, /DROP (?:TABLE|COLUMN)|DELETE FROM entities/i);

assert.match(lineage, /FROM entity_officer_lookup lookup/);
assert.match(lineage, /lookup\.officer_name_normalized = ANY/);
assert.doesNotMatch(lineage, /jsonb_array_elements/);
assert.match(lineage, /relatedLookupStatus: "available" \| "unavailable"/);
assert.match(section, /data-lineage-state="temporarily-unavailable"/);
assert.match(section, /not evidence that no\s+related entities exist/);

console.log("officer-lineage index assertions: PASS");
