# CA-CON-002 — California state publication

Public route: `/california`  
Snapshot version: `contractor-ca-state-intel-v1`  
Coverage: `ACQUIRED_PARTIAL_STREAM_TRUNCATED`

## Acquisition attempts

Three materially different License Master attempts, plus Personnel/WC (not page blockers), plus following the official `DownLoadFile.ashx` redirect discovered by attempt 1.

| # | Strategy | Result |
|---|----------|--------|
| 1 | HTTP/1.0 Connection: close CSV POST | 302 to `DownLoadFile.ashx?fName=MasterLicenseData&type=C` (redirect body saved, 196 bytes) |
| 2 | Excel (`lbMasterExcel`) HTTP/1.1 stream | Real xlsx (`PK..`) truncated at 5,801,477 bytes (`ChunkedEncodingError`, ~30s) |
| 3 | Official ListByClassification slices | Form still returns 34,986-byte HTML (`Please select at least one License Type`) |
| P | Personnel HTTP/1.0 | HTML select page, not a CSV |
| W | Workers' Comp HTTP/1.0 | 302 to `DownLoadFile.ashx?fName=WorkerCompData&type=C` |
| 1b | Follow official `DownLoadFile.ashx` (Master/Personnel/WC CSV) | Still chunked; Master 4.1MB truncated (worse than accepted 24.4MB); Personnel 4.0MB truncated; WC 6.2MB truncated |

Accepted source remains the CA-CON-001 License Master partial CSV:

- 24,437,638 bytes
- SHA-256 `f6ebbee6ed6c8b9476414e972382e6fcb4065f2c6e88a19392371a1e1e996838`
- **75,572** license rows / **75,572** distinct license numbers
- as of **2026-09-02**

Complete renewable denominator: **UNKNOWN**.

## Publication

Hero copy reports acquired rows and the truncated stream. It does not say “California has 75,572 contractors.”

Inventory search is labeled **Acquired CSLB public-data rows**. Compact public inventory lives at `/california-inventory.json` (no giant raw CSV in git).

No California county pages. No Review / AggregateRating / Trust Score schema. No paid ranking.

Personnel, standalone WC file, PWCR, vendor, and paid Full File failures are documented and are not page blockers.
