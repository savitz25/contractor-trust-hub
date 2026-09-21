"""TH-SEARCH-R1-019B-P2J mutation check: candidate-ID hydration must stay PK-driven via a LATERAL
correlated subquery, never regress to the old flat `JOIN contractors c ON c.id = name_prefilter.id`
shape whose cardinality misestimate (real Production EXPLAIN: ~13,595 estimated vs ~3 actual rows,
see docs/qa/th-search-r1-019b/p2i-post-analyze-explain-fullplans.local.json) drove a Hash Join against
a Parallel Seq Scan of contractors. Same convention as th_search_r1_019b_p2d_mutations.py: each
mutation is applied to ONE file, the gate (now including test 21, the P2J structural/EXPLAIN-shape
and native-Verify-parity proof) is run, and the exact original bytes are restored (sha256-verified)
in a finally block. A mutation is DETECTED when the gate fails.
"""
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone

GATE = "npx --yes tsx --test scripts/test_th_search_r1_019b.ts"

MUTATIONS = [
    {
        "id": "P2J_M1_lateral_reverted_to_flat_join",
        "file": "lib/contractors/name-search-core.ts",
        "find": """    fromSql = `(
        SELECT id FROM contractors
        WHERE ${CONTRACTOR_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
        UNION
        SELECT contractor_id FROM licenses
        WHERE ${CREDENTIAL_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
      ) name_prefilter
      CROSS JOIN LATERAL (
        SELECT * FROM contractors WHERE contractors.id = name_prefilter.id LIMIT 1
      ) c`;""",
        "replace": """    fromSql = `(
        SELECT id FROM contractors
        WHERE ${CONTRACTOR_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
        UNION
        SELECT contractor_id FROM licenses
        WHERE ${CREDENTIAL_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
      ) name_prefilter
      JOIN contractors c ON c.id = name_prefilter.id`;""",
        "meaning": "The P2J join-back regresses to the old flat JOIN -- exactly the shape whose cardinality misestimate the P2I evidence showed drives a Hash Join + Parallel Seq Scan of contractors in Production.",
    },
    {
        "id": "P2J_M2_lateral_limit_boundary_removed",
        "file": "lib/contractors/name-search-core.ts",
        "find": "SELECT * FROM contractors WHERE contractors.id = name_prefilter.id LIMIT 1\n      ) c`;",
        "replace": "SELECT * FROM contractors WHERE contractors.id = name_prefilter.id\n      ) c`;",
        "meaning": "The LIMIT 1 optimizer boundary is dropped from the LATERAL subquery -- the per-candidate PK-lookup shape is no longer structurally enforced.",
    },
    {
        "id": "P2J_M3_lateral_keyed_on_wrong_column",
        "file": "lib/contractors/name-search-core.ts",
        "find": "SELECT * FROM contractors WHERE contractors.id = name_prefilter.id LIMIT 1",
        "replace": "SELECT * FROM contractors WHERE contractors.slug = name_prefilter.id LIMIT 1",
        "meaning": "The LATERAL subquery is keyed on the wrong column (slug instead of id), silently breaking hydration -- candidates would no longer resolve to the correct contractor row.",
    },
    {
        "id": "P2J_M4_lateral_keyword_dropped",
        "file": "lib/contractors/name-search-core.ts",
        "find": "      CROSS JOIN LATERAL (\n        SELECT * FROM contractors WHERE contractors.id = name_prefilter.id LIMIT 1\n      ) c`;",
        "replace": "      CROSS JOIN (\n        SELECT * FROM contractors WHERE contractors.id = name_prefilter.id LIMIT 1\n      ) c`;",
        "meaning": "The LATERAL keyword itself is dropped; the correlated reference to name_prefilter.id inside the subquery becomes invalid SQL (Postgres requires LATERAL for a FROM-item to reference an earlier FROM-item), so the query fails outright rather than silently full-scanning.",
    },
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run_gate():
    proc = subprocess.run(GATE, shell=True, capture_output=True, text=True, encoding="utf8", errors="replace")
    failing = [line.strip() for line in proc.stdout.splitlines() if line.startswith("✖") and "failing tests" not in line]
    return proc.returncode, sorted(set(failing))


def main():
    baseline_code, baseline_failing = run_gate()
    if baseline_code != 0:
        print("gate is not green before mutation; refusing to run", baseline_failing)
        sys.exit(2)
    report = {"ranAt": datetime.now(timezone.utc).isoformat(), "gate": GATE, "baseline": "green", "mutations": []}
    for m in MUTATIONS:
        original = open(m["file"], "rb").read()
        before = sha(original)
        text = original.decode("utf8")
        if text.count(m["find"]) != 1:
            report["mutations"].append({**{k: m[k] for k in ("id", "file", "meaning")}, "detected": None, "error": "mutation site not found exactly once"})
            print(m["id"], "SITE NOT FOUND")
            continue
        try:
            open(m["file"], "wb").write(text.replace(m["find"], m["replace"], 1).encode("utf8"))
            code, failing = run_gate()
        finally:
            open(m["file"], "wb").write(original)
        restored = sha(open(m["file"], "rb").read()) == before
        report["mutations"].append({"id": m["id"], "file": m["file"], "meaning": m["meaning"], "detected": code != 0, "failingTests": failing, "restoredExactBytes": restored})
        print(m["id"], "DETECTED" if code != 0 else "SURVIVED", "restored" if restored else "RESTORE FAILED", len(failing), "failing")
        if not restored:
            sys.exit(3)
    final_code, _ = run_gate()
    report["gateGreenAfterRestore"] = final_code == 0
    report["detected"] = sum(1 for m in report["mutations"] if m.get("detected"))
    report["total"] = len(report["mutations"])
    open("docs/qa/th-search-r1-019b/p2j-mutation-report.local.json", "w", encoding="utf8", newline="\n").write(json.dumps(report, indent=2) + "\n")
    print(f"{report['detected']}/{report['total']} detected; gate green after restore: {report['gateGreenAfterRestore']}")
    sys.exit(0 if report["detected"] == report["total"] and report["gateGreenAfterRestore"] else 1)


main()
