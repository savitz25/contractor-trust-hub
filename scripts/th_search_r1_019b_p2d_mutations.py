"""TH-SEARCH-R1-019B-P2D mutation check: access-path separation between the strong (B-tree) and
token (GIN) tiers. Same convention as th_search_r1_019b_mutations.py -- each mutation is applied to
ONE file, the gate is run, and the exact original bytes are restored (sha256-verified) in a finally
block. A mutation is DETECTED when the gate fails. GATE runs the same test file as the original
harness (it now includes test 20, the P2D structural-separation and value-identity proof), so this
script also re-proves the five specific defects this ticket calls out never survive undetected.
"""
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone

GATE = "npx --yes tsx --test scripts/test_th_search_r1_019b.ts"

MUTATIONS = [
    {
        "id": "P2D_M1_token_tier_reverts_to_shared_bare_expression",
        "file": "lib/contractors/name-search-core.ts",
        "find": "        : `(${column} IS NOT NULL AND ${wordRule(tokenAccessExpressionSql(column))})`;",
        "replace": "        : `(${column} IS NOT NULL AND ${wordRule(normalizedFieldSql(column))})`;",
        "meaning": "The token tier's access path reverts to the SAME (bare) expression the strong tier's B-tree indexes are built on -- the exact architecture this ticket exists to eliminate.",
    },
    {
        "id": "P2D_M2_strong_tier_uses_token_expression",
        "file": "lib/contractors/name-search-core.ts",
        "find": "        ? `(${column} IS NOT NULL AND ${normalizedFieldSql(column)} LIKE ' ' || ${keyParam} || '%')`",
        "replace": "        ? `(${column} IS NOT NULL AND ${tokenAccessExpressionSql(column)} LIKE ' ' || ${keyParam} || '%')`",
        "meaning": "The strong tier's prefix predicate is rewritten onto the token access-path expression, making the strong-tier's own B-tree index (built on the bare expression) unable to serve its own query.",
    },
    {
        "id": "P2D_M3_token_gin_access_path_removed",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  return [\n    { name: `${table}_${field}_nameorder_idx`, table, kind: \"ordered\" as const, ddl: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${table}_${field}_nameorder_idx ON ${table} (${expr} text_pattern_ops) WHERE ${field} IS NOT NULL` },\n    { name: `${table}_${field}_namewords_idx`, table, kind: \"words\" as const, ddl: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${table}_${field}_namewords_idx ON ${table} USING gin (${tokenExpr} gin_trgm_ops) WHERE ${field} IS NOT NULL` },\n  ];",
        "replace": "  return [\n    { name: `${table}_${field}_nameorder_idx`, table, kind: \"ordered\" as const, ddl: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${table}_${field}_nameorder_idx ON ${table} (${expr} text_pattern_ops) WHERE ${field} IS NOT NULL` },\n  ];",
        "meaning": "The token tier's GIN index family is removed entirely -- every-word (contains) queries have no index access path left at all.",
    },
    {
        "id": "P2D_M4_wrapper_not_value_identical",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  return `(${normalizedFieldSql(column)} || '')`;",
        "replace": "  return `(${normalizedFieldSql(column)} || 'X')`;",
        "meaning": "The token access-path expression is no longer value-identical to the strong expression (an 'X' is silently appended), so the token tier would match different rows than the semantic predicate.",
    },
    {
        "id": "P2D_M5_word_boundary_loosened_to_please_planner",
        "file": "lib/contractors/name-search-core.ts",
        "find": ".map(({ term, p }) => ([...term].length < MIN_PREFIX_WORD_LENGTH ? `${normalized} LIKE '% ' || ${p} || ' %'` : `${normalized} LIKE '% ' || ${p} || '%'`))",
        "replace": ".map(({ p }) => `${normalized} LIKE '%' || ${p} || '%'`)",
        "meaning": "Word-boundary anchoring is dropped from the token tier's predicate (a change to matching semantics, not the access path), so a supplied word can match letters inside an unrelated word.",
    },
    {
        "id": "P2D_M6_required_word_dropped",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  const terms = kept.length > 0 ? kept : words;",
        "replace": "  const terms = (kept.length > 0 ? kept : words).slice(0, -1);",
        "meaning": "The last required supplied word is silently dropped, so a name is matched by a strict subset of what the customer typed.",
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
    open("docs/qa/th-search-r1-019b/p2d-mutation-report.local.json", "w", encoding="utf8", newline="\n").write(json.dumps(report, indent=2) + "\n")
    print(f"{report['detected']}/{report['total']} detected; gate green after restore: {report['gateGreenAfterRestore']}")
    sys.exit(0 if report["detected"] == report["total"] and report["gateGreenAfterRestore"] else 1)


main()
