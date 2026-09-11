#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROWS = json.loads((ROOT / "data/illinois/il-con-001/roofing-rows.json").read_text(encoding="utf-8"))

print("rows", len(ROWS))
print("keys", sorted({k for r in ROWS for k in r}))
print("license_type", Counter(r.get("license_type") for r in ROWS))
print("description", Counter(r.get("description") for r in ROWS))
print("business", Counter(r.get("business") for r in ROWS))
print("status", Counter(r.get("license_status") for r in ROWS).most_common())
print("ever_disciplined", Counter(r.get("ever_disciplined") for r in ROWS))
print("blank license", sum(1 for r in ROWS if not (r.get("license_number") or "").strip()))
print("case not null", sum(1 for r in ROWS if (r.get("case_number") or "").strip()))
print("action not null", sum(1 for r in ROWS if (r.get("action") or "").strip()))

by_id: dict[str, list] = defaultdict(list)
for r in ROWS:
    by_id[(r.get("license_number") or "").strip()].append(r)
print("distinct ids", len([k for k in by_id if k]))
print("ids with >1 row", sum(1 for k, v in by_id.items() if k and len(v) > 1))
print("max rows per id", max((len(v) for v in by_id.values()), default=0))

# sample repeats
repeats = [(k, v) for k, v in by_id.items() if k and len(v) > 1]
print("repeat sample")
for k, v in repeats[:5]:
    print(" ID", k, "n", len(v))
    for row in v:
        print("  ", row.get("description"), row.get("license_status"), row.get("business"), "case", row.get("case_number"), "action", (row.get("action") or "")[:40], "exp", row.get("expiration_date"), "eff", row.get("effective_date"))

# licensed contractor vs QP
def desc(r):
    return (r.get("description") or "").strip().upper()

biz_rows = [r for r in ROWS if desc(r) == "LICENSED ROOFING CONTRACTOR"]
qp_rows = [r for r in ROWS if desc(r) == "QUALIFYING PARTY ROOFING CONTRACTOR"]
print("biz rows", len(biz_rows), "qp rows", len(qp_rows), "other", len(ROWS) - len(biz_rows) - len(qp_rows))

def subset_stats(name, subset, biz_expect=None):
    ids = [(r.get("license_number") or "").strip() for r in subset]
    nonempty = [i for i in ids if i]
    c = Counter(nonempty)
    dups = sum(1 for i, n in c.items() if n > 1)
    status = Counter((r.get("license_status") or "").strip() for r in subset)
    biz = Counter((r.get("business") or "").strip() for r in subset)
    print(name, "rows", len(subset), "distinct", len(c), "dup_ids", dups)
    print("  status", status.most_common())
    print("  business", biz)
    active = [r for r in subset if (r.get("license_status") or "").strip().upper() == "ACTIVE"]
    active_ids = {(r.get("license_number") or "").strip() for r in active if (r.get("license_number") or "").strip()}
    print("  ACTIVE rows", len(active), "ACTIVE distinct", len(active_ids))
    # status conflicts per id
    by = defaultdict(set)
    biz_by = defaultdict(set)
    desc_by = defaultdict(set)
    for r in subset:
        i = (r.get("license_number") or "").strip()
        if not i:
            continue
        by[i].add((r.get("license_status") or "").strip())
        biz_by[i].add((r.get("business") or "").strip())
        desc_by[i].add(desc(r))
    status_conflict = sum(1 for i, s in by.items() if len(s) > 1)
    biz_conflict = sum(1 for i, s in biz_by.items() if len(s) > 1)
    print("  ids with status conflict", status_conflict, "biz-flag conflict", biz_conflict)

subset_stats("LICENSED ROOFING CONTRACTOR", biz_rows)
subset_stats("QUALIFYING PARTY", qp_rows)

# same license_number on both classes?
biz_ids = {(r.get("license_number") or "").strip() for r in biz_rows}
qp_ids = {(r.get("license_number") or "").strip() for r in qp_rows}
print("id overlap biz∩qp", len(biz_ids & qp_ids))
if biz_ids & qp_ids:
    print(" overlap sample", list(biz_ids & qp_ids)[:8])

# ACTIVE licensed contractor Y
active_biz = [r for r in biz_rows if (r.get("license_status") or "").upper() == "ACTIVE" and (r.get("business") or "") == "Y"]
print("active licensed contractor Y rows", len(active_biz), "distinct", len({(r.get("license_number") or "").strip() for r in active_biz}))
# ACTIVE licensed contractor any business flag
active_biz_any = [r for r in biz_rows if (r.get("license_status") or "").upper() == "ACTIVE"]
print("active licensed contractor any-flag rows", len(active_biz_any), "distinct", len({(r.get("license_number") or "").strip() for r in active_biz_any}))

# case ids
cases = [(r.get("case_number") or "").strip() for r in ROWS if (r.get("case_number") or "").strip()]
print("case rows", len(cases), "distinct cases", len(set(cases)))
flag_y = [r for r in ROWS if (r.get("ever_disciplined") or "").upper() == "Y"]
print("flag Y rows", len(flag_y), "distinct ids", len({(r.get("license_number") or "").strip() for r in flag_y}))

# geography
print("state", Counter((r.get("state") or "").strip() for r in ROWS).most_common(8))
print("out of IL", sum(1 for r in ROWS if (r.get("state") or "").strip().upper() not in {"IL", ""}))
print("license number sample", [(r.get("license_number"), r.get("description")) for r in ROWS[:8]])

# why repeats: compare fields among dups
field_diff = Counter()
for k, v in repeats[:200]:
    keys = set().union(*[set(r.keys()) for r in v])
    for f in keys:
        vals = {(r.get(f) or "") for r in v}
        if len(vals) > 1:
            field_diff[f] += 1
print("fields that differ among first 200 duplicate IDs", field_diff.most_common())
