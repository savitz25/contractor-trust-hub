from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/kansas/page.tsx").read_text(encoding="utf-8")
snapshot = (ROOT / "lib/kansas-intelligence/snapshot.ts").read_text(encoding="utf-8")
paths = (ROOT / "lib/seo/published-state-path.ts").read_text(encoding="utf-8")
coverage = (ROOT / "lib/states/published-coverage.ts").read_text(encoding="utf-8")

assert 'path: "/kansas"' in page
assert '"kansas"' in paths
assert 'kansas: "KS"' in coverage
assert 'generalContractorStatewideLicense: "NOT_ESTABLISHED"' in snapshot
assert 'population: "NOT_ACQUIRED"' in snapshot
assert 'rows: 33' in snapshot
assert 'rows: 259' in snapshot
assert 'SHA-256 {row.sha256}' in page
assert "administrator" not in page.lower()
assert "AggregateRating" not in page
assert "Trust Score" not in page
assert "/kansas/wichita" not in page
assert "No local license populations were acquired" in page
assert "No adverse record was joined by name" in page

print("KS-CON-001 publication assertions passed")
