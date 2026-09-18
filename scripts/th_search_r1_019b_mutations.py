"""TH-SEARCH-R1-019B mutation check.

Each mutation is applied to ONE file, the gate is run, and the exact original bytes are restored
(sha256-verified) in a finally block. A mutation is DETECTED when the gate fails.
Only files created or edited by this workstream are ever touched.
"""
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone

GATE = "npx --yes tsx --test scripts/test_th_search_r1_019b.ts"

MUTATIONS = [
    {
        "id": "M1_drop_name_predicate",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  return `(\n          ${perField.join(",
        "replace": "  return `(TRUE OR\n          ${perField.join(",
        "meaning": "The shared name predicate admits every row (an unfiltered cohort dressed up as name matches).",
    },
    {
        "id": "M2_source_failure_becomes_empty_success",
        "file": "lib/specialist-execution/contractor-name-candidates.ts",
        "find": '      ...envelope(), resultState: "SOURCE_FAILURE", errorCode: `source_${kind}`, failureKind: kind,',
        "replace": '      ...envelope(), resultState: "COMPLETED_NO_CANDIDATES", errorCode: `source_${kind}`, failureKind: kind,',
        "meaning": "A timeout / unavailable source is reported as a searched-and-missed result.",
    },
    {
        "id": "M3_ignore_explicit_jurisdiction",
        "file": "lib/specialist-execution/contractor-name-candidates.ts",
        "find": "  const scopes = input.jurisdiction ? allScopes.filter((scope) => scope.code === input.jurisdiction) : allScopes;",
        "replace": "  const scopes = allScopes;",
        "meaning": "An explicit jurisdiction constraint is silently dropped and every scope is searched.",
    },
    {
        "id": "M4_drop_publication_gate",
        "file": "lib/contractors/name-candidates-query.ts",
        "find": "      WHERE c.is_thin_profile = FALSE\n        AND c.slug IS NOT NULL AND c.slug <> ''\n        AND ${nameMatchPredicateSql",
        "replace": "      WHERE ${nameMatchPredicateSql",
        "meaning": "Held/thin and destination-less profiles are promoted into public candidates.",
    },
    {
        "id": "M5_remove_row_level_evidence_check",
        "file": "lib/specialist-execution/contractor-name-candidates.ts",
        "find": '  if (!evidence) throw new Error("name_predicate_evidence_missing");',
        "replace": '  if (!evidence) return { stableKey: `contractor:profile:${row.slug}`, displayName: row.display_name, match: { field: "display_name", value: row.display_name, method: "NAME_CONTAINS", explanation: "" } } as never;',
        "meaning": "A row whose own names do not explain the match is displayed anyway (source echo trusted as proof).",
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
    report["detected"] = sum(1 for m in report["mutations"] if m["detected"])
    report["total"] = len(report["mutations"])
    open("docs/qa/th-search-r1-019b/mutation-report.json", "w", encoding="utf8", newline="\n").write(json.dumps(report, indent=2) + "\n")
    print(f"{report['detected']}/{report['total']} detected; gate green after restore: {report['gateGreenAfterRestore']}")
    sys.exit(0 if report["detected"] == report["total"] and report["gateGreenAfterRestore"] else 1)


main()
