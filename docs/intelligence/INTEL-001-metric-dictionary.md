# INTEL-001 — Metric dictionary

Canonical definitions live in `lib/intelligence/metric-dictionary.ts`.

These layers are **not interchangeable**:

raw source record → parsed observation → matched observation → attributed evidence → distinct credential → distinct person → distinct business → relationship → finding/disposition

## What “104,444 active licenses” means

| Phrase | Entity counted | Rule | Public? |
| --- | --- | --- | --- |
| **104,444 active licenses** | **Credentials** (`licenses` rows, `source_system=fl_dbpr`, `status_normalized=active`) | DBPR secondary status `A` only | Yes |
| Active contractor businesses | Resolved **businesses** with ≥1 active trade credential | Requires identity graph | **Not yet calculable** |

Do not add `status_normalized=current`. That bucket is FRO + CRS1 + PVDR (education / financially responsible officer), not active trade licenses.

Do not treat `contractors` row counts as distinct persons or distinct businesses. The loader creates **one product shell per license**.

## Required fields on every metric

- Entity being counted
- Deduplication key
- Filters
- Date rules
- Status rules
- Attribution threshold
- Public eligibility: `public` / `internal_only` / `not_yet_calculable`

Unresolved evidence is retained internally and is never a public allegation.
