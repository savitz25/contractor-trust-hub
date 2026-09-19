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
        "find": "  const predicateSql = `(\n          ${NAME_MATCH_FIELDS",
        "replace": "  const predicateSql = `(TRUE OR\n          ${NAME_MATCH_FIELDS",
        "meaning": "The shared name predicate admits every prefiltered row (a cohort dressed up as name matches).",
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
        "find": "      WHERE c.is_thin_profile = FALSE\n        AND c.slug IS NOT NULL AND c.slug <> ''\n        AND ${match.predicateSql}",
        "replace": "      WHERE ${match.predicateSql}",
        "meaning": "Held/thin and destination-less profiles are promoted into public candidates.",
    },
    {
        "id": "M5_remove_row_level_evidence_check",
        "file": "lib/specialist-execution/contractor-name-candidates.ts",
        "find": '  if (!evidence) throw new Error("name_predicate_evidence_missing");',
        "replace": '  if (!evidence) return { stableKey: `contractor:profile:${row.slug}`, displayName: row.display_name, match: { field: "display_name", value: row.display_name, method: "PREFIX_OR_TOKEN", explanation: "" } } as never;',
        "meaning": "A row whose own names do not explain the match is displayed anyway (source echo trusted as proof).",
    },
    {
        "id": "M6_prefilter_uses_fused_pseudo_word",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  const fragments = [...new Set(used.map(",
        "replace": "  const fragments = terms.every((t) => t.length < 3) ? [terms.join(\" \")] : [...new Set(used.map(",
        "meaning": "Review finding 2: initials are fused into a normalized pseudo-word ('R T') that the raw field ('R & T') never contains, so the prefilter drops an exact source name.",
    },
    {
        "id": "M7_initials_not_required",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  const terms = used.map(({ term }) => term);",
        "replace": "  const terms = used.map(({ term }) => term).filter((w) => w.length >= 2);",
        "meaning": "Review finding 3: single-letter initials are dropped, making 'R & T General Construction' equivalent to 'General Construction'.",
    },
    {
        "id": "M8_only_first_four_words_required",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  const terms = used.map(({ term }) => term);",
        "replace": "  const terms = used.map(({ term }) => term).slice(0, 4);",
        "meaning": "Review finding 3: words after the fourth are ignored, so '... Estate Alpha' matches '... Estate Beta'.",
    },
    {
        "id": "M9_initial_matches_inside_a_word",
        "file": "lib/contractors/name-search-core.ts",
        "find": "      .map(({ term, p }) => (term.length < MIN_PREFIX_WORD_LENGTH ? `${normalized} LIKE '% ' || ${p} || ' %'` : `${normalized} LIKE '% ' || ${p} || '%'`))",
        "replace": "      .map(({ p }) => `${normalized} LIKE '%' || ${p} || '%'`)",
        "meaning": "Review finding 3: a word (including an initial) matches any letters inside a source word.",
    },
    {
        "id": "M10_no_equality_rank_tier",
        "file": "lib/contractors/name-search-core.ts",
        "find": "          WHEN ${equalsName(\"display_name\")} THEN 0\n          WHEN ${others.map(equalsName).join(\" OR \")} THEN 1\n",
        "replace": "",
        "meaning": "Review finding 4: no full-name equality tier, so an exact target sorts behind 200+ prefix siblings and falls past the cap.",
    },
    {
        "id": "M11_last_window_not_clamped_to_cap",
        "file": "lib/specialist-execution/contractor-name-candidates.ts",
        "find": "limit: Math.min(input.limit, NAME_SOURCE_CAP - offset), offset }, db);",
        "replace": "limit: input.limit, offset }, db);",
        "meaning": "Review finding 4: page 9 x 24 returns rows 193-216, beyond the advertised 200-row cap.",
    },
    {
        "id": "M12_apostrophe_not_equivalent",
        "file": "lib/contractors/name-search-core.ts",
        "find": "    .replace(/['`‘’]/g, \"\")\n    .replace(/[^\\x00-\\x7F]/g, \" \")",
        "replace": "    .replace(/[^\\x00-\\x7F]/g, \" \")",
        "meaning": "Review finding 3: 'OBrien' no longer finds O'BRIEN (supplied-side apostrophe handling removed; SQL and JS normalizers diverge).",
    },
    {
        "id": "M13_representative_row_ignores_name_strength",
        "file": "lib/contractors/name-candidates-query.ts",
        "find": "      ORDER BY c.id,\n        ${match.rankSql},\n",
        "replace": "      ORDER BY c.id,\n",
        "meaning": "Review finding 4: an active but unrelated credential row displaces the exact matched source row.",
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
