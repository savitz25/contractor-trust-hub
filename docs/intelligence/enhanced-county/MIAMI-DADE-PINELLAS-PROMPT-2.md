# Miami-Dade + Pinellas — Prompt 2

**Production writes:** jurisdiction metadata only (60 rows). No Stage E permit/credential/enforcement load. Enhanced = NO.

## Jurisdiction seed

Applied 2026-08-26 via PostgREST upsert. Broward 32 + Palm Beach 40 unchanged.

| County | unincorporated | municipal | total |
| --- | ---: | ---: | ---: |
| Miami-Dade | 1 | 34 | 35 |
| Pinellas | 1 | 24 | 25 |
| **All AHJs** | | | **132** |

## Direct acquisition

| Source | Rows | SHA-256 | Stage E |
| --- | ---: | --- | --- |
| MDC Open Data issued permits | 139,586 | `9e9fe2d711dd8c2ec13d4832b70fe41ae9440c7a3be0b51910c22f8eb6c3effa` | NOT_LOADED |
| City of Miami Building Permits Since 2014 | 230,545 | `7942d67f2b333ed1703a96783412f53c21f76e1d2243849f671b3b9f573cf1bc` | NOT_LOADED |

Raw JSONL under `data/raw/` (gitignored). Manifests + Stage A–D reports are kept.

## PRA

Anonymous GovQA forms reached. **CAPTCHA blocked submit** (“The submitted CAPTCHA code is incorrect”). Pinellas also requires CREATE ANONYMOUS ACCOUNT before the request form. Packages remain ready in `pra-bodies/` and `pra-*.md`. Not filed. No >$25 charge.

## Importers

Python contracts + TEST_ONLY fixtures. Stage E still refuses TEST_ONLY and unsigned production loads.
