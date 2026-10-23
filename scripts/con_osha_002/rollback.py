"""Batch-and-state rollback text. The statements are not executed here."""

from __future__ import annotations

from uuid import UUID

from scripts.con_osha_002.contract import EXPANSION_BATCH_SOURCE, EXPANSION_STATES
from scripts.con_osha_002.eligibility import LoadError

_PLACEHOLDER = "00000000-0000-0000-0000-000000000000"


def rollback_sql(state: str, batch_id: str) -> str:
    if state not in EXPANSION_STATES:
        raise LoadError("rollback state is not an expansion state")
    try:
        batch = str(UUID(batch_id))
    except ValueError as exc:
        raise LoadError("batch id must be a UUID") from exc
    if batch == _PLACEHOLDER:
        raise LoadError("rollback batch id is still the placeholder")
    return "\n".join([
        "BEGIN;",
        "DO $$ BEGIN",
        "  IF NOT EXISTS (",
        "    SELECT 1 FROM ingest_batches",
        f"     WHERE id = '{batch}'::uuid",
        f"       AND source_system = '{EXPANSION_BATCH_SOURCE}'",
        "  ) THEN RAISE EXCEPTION 'expansion batch guard failed'; END IF;",
        "END $$;",
        "DELETE FROM contractor_osha_citations c",
        " USING contractor_osha_inspections i",
        " WHERE c.inspection_id = i.id",
        f"   AND c.source_batch_id = '{batch}'::uuid",
        f"   AND i.source_batch_id = '{batch}'::uuid",
        f"   AND i.state = '{state}';",
        "DELETE FROM contractor_osha_match_inspections",
        f" WHERE source_batch_id = '{batch}'::uuid",
        f"   AND state = '{state}';",
        "DELETE FROM contractor_osha_inspections i",
        f" WHERE i.source_batch_id = '{batch}'::uuid",
        f"   AND i.state = '{state}'",
        "   AND NOT EXISTS (",
        "     SELECT 1 FROM contractor_osha_match_inspections b WHERE b.inspection_id = i.id",
        "   );",
        "DELETE FROM contractor_osha_license_matches",
        f" WHERE ingest_batch_id = '{batch}'::uuid",
        f"   AND state = '{state}'",
        "   AND expansion_receipt_id IS NOT NULL;",
        "DELETE FROM contractor_osha_identity_review",
        f" WHERE ingest_batch_id = '{batch}'::uuid",
        f"   AND state = '{state}'",
        "   AND expansion_receipt_id IS NOT NULL;",
        "DELETE FROM contractor_osha_expansion_holds",
        f" WHERE ingest_batch_id = '{batch}'::uuid",
        f"   AND state = '{state}';",
        "DELETE FROM osha_expansion_load_receipts",
        f" WHERE ingest_batch_id = '{batch}'::uuid",
        f"   AND state = '{state}';",
        "DELETE FROM osha_detail_load_receipts r",
        f" WHERE r.source_batch_id = '{batch}'::uuid",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_inspections i WHERE i.receipt_id = r.id OR i.source_batch_id = r.source_batch_id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_citations c WHERE c.receipt_id = r.id OR c.source_batch_id = r.source_batch_id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_match_inspections b WHERE b.receipt_id = r.id OR b.source_batch_id = r.source_batch_id);",
        "DELETE FROM ingest_batches b",
        f" WHERE b.id = '{batch}'::uuid",
        f"   AND b.source_system = '{EXPANSION_BATCH_SOURCE}'",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_license_matches m WHERE m.ingest_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_identity_review r WHERE r.ingest_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM osha_load_receipts o WHERE o.ingest_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_inspections i WHERE i.source_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_citations c WHERE c.source_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_match_inspections br WHERE br.source_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM osha_expansion_load_receipts e WHERE e.ingest_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM osha_detail_load_receipts d WHERE d.source_batch_id = b.id)",
        "   AND NOT EXISTS (SELECT 1 FROM contractor_osha_expansion_holds h WHERE h.ingest_batch_id = b.id);",
        "COMMIT;",
    ])
