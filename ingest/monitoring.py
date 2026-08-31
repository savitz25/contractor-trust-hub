"""Deterministic, material change detection for structured regulatory ingest."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime
from typing import Any


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text.upper() or None


def normalize_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return str(value).strip() or None


def license_material_state(row: dict[str, Any]) -> dict[str, dict[str, str | None]]:
    return {
        "status": {
            "primary": normalize_text(row.get("primary_status")),
            "secondary": normalize_text(row.get("secondary_status")),
            "normalized": normalize_text(row.get("status_normalized")),
        },
        "expiration": {"date": normalize_date(row.get("expiration_date"))},
        "official_address": {
            "line1": normalize_text(row.get("address_line_1")),
            "line2": normalize_text(row.get("address_line_2")),
            "line3": normalize_text(row.get("address_line_3")),
            "city": normalize_text(row.get("city")),
            "state": normalize_text(row.get("state")),
            "postal_code": normalize_text(row.get("postal_code")),
        },
        "business_identity": {
            "licensee_name": normalize_text(row.get("licensee_name_raw")),
            "dba_name": normalize_text(row.get("dba_name_raw")),
        },
    }


CHANGE_FIELDS = {
    "status": "LICENSE_STATUS_CHANGED",
    "expiration": "LICENSE_EXPIRATION_CHANGED",
    "official_address": "OFFICIAL_ADDRESS_CHANGED",
    "business_identity": "BUSINESS_IDENTITY_CHANGED",
}


def material_license_changes(before: dict[str, Any], after: dict[str, Any]) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    old, new = license_material_state(before), license_material_state(after)
    return [(change_type, old[key], new[key]) for key, change_type in CHANGE_FIELDS.items() if old[key] != new[key]]


def event_fingerprint(*, contractor_id: str, source_system: str, source_record_id: str,
                      change_type: str, prior_state: Any, current_state: Any,
                      source_effective_at: str | None = None) -> str:
    payload = {
        "contractor_id": str(contractor_id).lower(),
        "source_system": source_system.lower(),
        "source_record_id": source_record_id.upper(),
        "change_type": change_type,
        "prior_state": prior_state,
        "current_state": current_state,
        "source_effective_at": source_effective_at,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def insert_change_event(cur, *, contractor_id: Any, source_system: str, source_dataset: str,
                        source_record_id: str, change_type: str, prior_state: Any,
                        current_state: Any, ingest_batch_id: Any,
                        source_effective_at: str | None = None, provenance: dict[str, Any] | None = None) -> bool:
    fingerprint = event_fingerprint(
        contractor_id=str(contractor_id), source_system=source_system,
        source_record_id=source_record_id, change_type=change_type,
        prior_state=prior_state, current_state=current_state,
        source_effective_at=source_effective_at,
    )
    cur.execute(
        """INSERT INTO regulatory_change_events
             (contractor_id,source_system,source_dataset,source_record_id,change_type,
              prior_state,current_state,source_effective_at,ingest_batch_id,fingerprint_sha256,provenance)
           VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::timestamptz,%s,%s,%s::jsonb)
           ON CONFLICT (fingerprint_sha256) DO NOTHING RETURNING id""",
        (contractor_id, source_system, source_dataset, source_record_id, change_type,
         json.dumps(prior_state) if prior_state is not None else None, json.dumps(current_state),
         source_effective_at, ingest_batch_id, fingerprint, json.dumps(provenance or {})),
    )
    return cur.fetchone() is not None
