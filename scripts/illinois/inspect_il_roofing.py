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

def nonempty_id(row: dict) -> str:
    return (row.get("license_number") or "").strip()


by_id: dict[str, list] = defaultdict(list)
for r in ROWS:
    i = nonempty_id(r)
    if not i:
        continue
    by_id[i].append(r)
print("distinct ids", len(by_id))
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
    ids = [nonempty_id(r) for r in subset]
    nonempty = [i for i in ids if i]
    c = Counter(nonempty)
    dups = sum(1 for n in c.values() if n > 1)
    status = Counter((r.get("license_status") or "").strip() for r in subset)
    biz = Counter((r.get("business") or "").strip() for r in subset)
    print(name, "rows", len(subset), "distinct", len(c), "dup_ids", dups, "blank", sum(1 for i in ids if not i))
    print("  status", status.most_common())
    print("  business", biz)
    active = [r for r in subset if (r.get("license_status") or "").strip().upper() == "ACTIVE"]
    active_ids = {nonempty_id(r) for r in active if nonempty_id(r)}
    print("  ACTIVE rows", len(active), "ACTIVE distinct", len(active_ids))
    by = defaultdict(set)
    biz_by = defaultdict(set)
    for r in subset:
        i = nonempty_id(r)
        if not i:
            continue
        by[i].add((r.get("license_status") or "").strip())
        biz_by[i].add((r.get("business") or "").strip())
    status_conflict = sum(1 for s in by.values() if len(s) > 1)
    biz_conflict = sum(1 for s in biz_by.values() if len(s) > 1)
    print("  ids with status conflict", status_conflict, "biz-flag conflict", biz_conflict)

subset_stats("LICENSED ROOFING CONTRACTOR", biz_rows)
subset_stats("QUALIFYING PARTY", qp_rows)

# same license_number on both classes — blank is not an identity
biz_ids = {nonempty_id(r) for r in biz_rows if nonempty_id(r)}
qp_ids = {nonempty_id(r) for r in qp_rows if nonempty_id(r)}
print("id overlap biz∩qp nonempty", len(biz_ids & qp_ids))
if biz_ids & qp_ids:
    print(" overlap sample", list(biz_ids & qp_ids)[:8])

active_biz = [r for r in biz_rows if (r.get("license_status") or "").upper() == "ACTIVE" and (r.get("business") or "") == "Y"]
print("active licensed contractor Y rows", len(active_biz), "distinct", len({nonempty_id(r) for r in active_biz if nonempty_id(r)}))
active_biz_any = [r for r in biz_rows if (r.get("license_status") or "").upper() == "ACTIVE"]
print("active licensed contractor any-flag rows", len(active_biz_any), "distinct", len({nonempty_id(r) for r in active_biz_any if nonempty_id(r)}))

cases = [(r.get("case_number") or "").strip() for r in ROWS if (r.get("case_number") or "").strip()]
print("case rows", len(cases), "distinct cases", len(set(cases)))
flag_y = [r for r in ROWS if (r.get("ever_disciplined") or "").upper() == "Y"]
flag_ids = {nonempty_id(r) for r in flag_y if nonempty_id(r)}
print("flag Y rows", len(flag_y), "distinct nonempty ids", len(flag_ids))
print("flag Y blank ids", sum(1 for r in flag_y if not nonempty_id(r)))

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
