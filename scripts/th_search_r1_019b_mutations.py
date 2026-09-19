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
        "id": "M6_raw_fragment_gate_restored",
        "file": "lib/contractors/name-search-core.ts",
        "find": "    const fieldRule = (column: string) => tierRule(column);",
        "replace": "    const fieldRule = (column: string) => `(${termParams.filter(({ term }) => term.length >= 3).map(({ p }) => `upper(${column}) LIKE '%' || ${p} || '%'`).concat(['TRUE']).join(' AND ')} AND ${tierRule(column)})`;",
        "meaning": "Review 2 finding 1: the access path again requires each supplied word verbatim in the RAW source text, so 'ONeil Plumbing' cannot reach O'NEIL PLUMBING LLC although the semantics say it matches.",
    },
    {
        "id": "M7_initials_not_required",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  const terms = kept.length > 0 ? kept : words;",
        "replace": "  const terms = (kept.length > 0 ? kept : words).filter((w) => w.length >= 2);",
        "meaning": "Review 1 finding 3: single-letter initials are dropped, making 'R & T General Construction' equivalent to 'General Construction'.",
    },
    {
        "id": "M8_only_first_four_words_required",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  const terms = kept.length > 0 ? kept : words;",
        "replace": "  const terms = (kept.length > 0 ? kept : words).slice(0, 4);",
        "meaning": "Review 1 finding 3: words after the fourth are ignored, so '... Estate Alpha' matches '... Estate Beta'.",
    },
    {
        "id": "M9_initial_matches_inside_a_word",
        "file": "lib/contractors/name-search-core.ts",
        "find": "      .map(({ term, p }) => ([...term].length < MIN_PREFIX_WORD_LENGTH ? `${normalized} LIKE '% ' || ${p} || ' %'` : `${normalized} LIKE '% ' || ${p} || '%'`))",
        "replace": "      .map(({ p }) => `${normalized} LIKE '%' || ${p} || '%'`)",
        "meaning": "Review 1 finding 3: a word (including an initial) matches any letters inside a source word.",
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
        "id": "M12_source_apostrophe_becomes_word_break",
        "file": "lib/contractors/name-search-core.ts",
        "find": "  return `(' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(${column}, '')), '${APOSTROPHES_SQL}', '', 'g'), '${SEPARATORS_SQL}', ' ', 'g')) || ' ')`;",
        "replace": "  return `(' ' || btrim(regexp_replace(upper(coalesce(${column}, '')), '${SEPARATORS_SQL}', ' ', 'g')) || ' ')`;",
        "meaning": "Review 2 finding 1: the source side stops removing apostrophes (O'NEIL becomes O NEIL), so 'ONeil' no longer finds it -- the two directions stop being symmetric.",
    },
    {
        "id": "M14_non_ascii_deleted_from_source_name",
        "file": "lib/contractors/name-search-core.ts",
        "find": "const SEPARATORS_SQL = \"[",
        "replace": "const SEPARATORS_SQL = \"[\\\\u0080-\\\\uFFFF",
        "meaning": "Review 2 finding 1: non-ASCII letters are turned into breaks again, so JOS\u00c9 BUILDERS collapses into JOS BUILDERS.",
    },
    {
        "id": "M15_token_tier_timeout_reported_complete",
        "file": "lib/contractors/name-candidates-query.ts",
        "find": "tiers: { strong: \"COMPLETED\", token: \"NOT_COMPLETED\" }, queries };",
        "replace": "tiers: { strong: \"COMPLETED\", token: \"COMPLETED\" }, queries };",
        "meaning": "Review 2 finding 2: an unfinished token tier is presented as a complete result.",
    },
    {
        "id": "M16_token_tier_runs_before_strong_page_is_known_full",
        "file": "lib/contractors/name-candidates-query.ts",
        "find": "  if (strongRows.length > args.limit) {",
        "replace": "  if (false as boolean) {",
        "meaning": "Review 2 finding 2: the weak (contains-every-word) scan runs even when strong matches already fill the page.",
    },
    {
        "id": "M17_tier_boundary_offset_wrong",
        "file": "lib/contractors/name-candidates-query.ts",
        "find": "want + 1, Math.max(0, args.offset - strongCount), remaining());",
        "replace": "want + 1, args.offset, remaining());",
        "meaning": "Review 2 finding 2: the token tier restarts from the page offset instead of continuing after the strong tier (rows skipped at the boundary).",
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
