"""Fail-closed Florida DBPR adverse-evidence credential resolver.

Numeric-core-only and respondent-name matching are intentionally absent. A caller
must provide official source type/number fields and a current DBPR license inventory.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Literal

DICTIONARY_PATH = Path(__file__).with_name("fl_dbpr_license_types.v1.json")
IdentityState = Literal["EXACT", "DETERMINISTIC", "REVIEW_REQUIRED", "UNRESOLVED"]


@dataclass(frozen=True)
class LicenseCredential:
    id: str
    external_key: str
    occupation_code: str | None
    license_number: str | None
    source_board: str | None = None
    contractor_id: str | None = None


@dataclass(frozen=True)
class Resolution:
    identity_state: IdentityState
    identity_method: str
    resolver_version: str
    proposed_license_id: str | None
    resolved_external_key: str | None
    expected_external_key: str | None
    reason: str
    candidate_count: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def normalize_identifier(value: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def normalize_numeric_core(value: str | None) -> str | None:
    digits = re.sub(r"[^0-9]", "", value or "")
    if not digits:
        return None
    return digits.lstrip("0") or digits


class FloridaDbprCredentialResolver:
    def __init__(
        self,
        licenses: Iterable[LicenseCredential],
        *,
        dictionary_path: Path = DICTIONARY_PATH,
    ) -> None:
        data = json.loads(dictionary_path.read_text(encoding="utf-8"))
        self.version = str(data["version"])
        self.board = str(data["board"])
        self._mapping = {
            str(row["source_label"]).strip().casefold(): row
            for row in data["mappings"]
        }
        self._by_external: dict[str, list[LicenseCredential]] = {}
        self._by_type_core: dict[tuple[str, str], list[LicenseCredential]] = {}
        self._by_core: dict[str, list[LicenseCredential]] = {}
        self._licenses = list(licenses)
        for lic in self._licenses:
            self._by_external.setdefault(normalize_identifier(lic.external_key), []).append(lic)
            core = normalize_numeric_core(lic.license_number)
            occupation = normalize_identifier(lic.occupation_code)
            if core:
                self._by_core.setdefault(core, []).append(lic)
                self._by_type_core.setdefault((occupation, core), []).append(lic)

    def resolve(
        self,
        *,
        source_dataset: str,
        license_type: str | None,
        license_number: str | None,
        source_board: str | None = None,
        respondent_name: str | None = None,
    ) -> Resolution:
        del respondent_name  # Names are forbidden as automatic adverse-evidence anchors.
        dataset = (source_dataset or "").strip()
        if dataset == "contractor_disc_ula" and not (license_number or "").strip():
            return self._result("UNRESOLVED", "respondent_only_ula", None, None, None,
                                "ULA bulk rows have no license credential; name-only linkage is prohibited", 0)

        mapping = self._mapping.get((license_type or "").strip().casefold())
        if mapping is None:
            return self._result("REVIEW_REQUIRED", "unknown_license_type", None, None, None,
                                "Official DBPR license type is missing or not in the versioned dictionary", 0)

        number = normalize_identifier(license_number)
        if not number:
            return self._result("UNRESOLVED", "missing_license_number", None, None, None,
                                "No parseable official credential number", 0)

        prefix = normalize_identifier(str(mapping["credential_prefix"]))
        expected = number if number.startswith(prefix) else f"{prefix}{number}"
        exact = self._by_external.get(expected, [])
        if len(exact) > 1:
            return self._result("REVIEW_REQUIRED", "duplicate_external_key", None, None, expected,
                                "More than one DBPR license has the expected full credential", len(exact))
        if len(exact) == 1:
            lic = exact[0]
            if source_board and lic.source_board and source_board != lic.source_board:
                return self._result("REVIEW_REQUIRED", "board_conflict", None, None, expected,
                                    "Source board conflicts with the resolved credential", 1)
            state: IdentityState = (
                "EXACT" if mapping["classification"] == "EXACT_OFFICIAL" else "DETERMINISTIC"
            )
            return self._result(state, "official_type_plus_external_key", lic.id,
                                lic.external_key, expected, "Unique authoritative full credential", 1)

        core = normalize_numeric_core(number)
        typed = [
            lic for lic in self._by_type_core.get((prefix, core or ""), [])
            if not source_board or not lic.source_board or lic.source_board == source_board
        ]
        if len(typed) == 1:
            lic = typed[0]
            return self._result("DETERMINISTIC", "official_type_board_number", lic.id,
                                lic.external_key, expected,
                                "Unique type/board/number credential; external-key representation differs", 1)
        if len(typed) > 1:
            return self._result("REVIEW_REQUIRED", "multiple_typed_candidates", None, None, expected,
                                "Official type and number select multiple credentials", len(typed))

        numeric_candidates = self._by_core.get(core or "", [])
        if numeric_candidates:
            return self._result("REVIEW_REQUIRED", "identifier_type_conflict", None, None, expected,
                                "Numeric candidates exist but none agrees with the official type", len(numeric_candidates))
        return self._result("UNRESOLVED", "credential_not_found", None, None, expected,
                            "No corresponding credential exists in the current DBPR license inventory", 0)

    def _result(
        self,
        state: IdentityState,
        method: str,
        license_id: str | None,
        external_key: str | None,
        expected: str | None,
        reason: str,
        count: int,
    ) -> Resolution:
        return Resolution(state, method, self.version, license_id, external_key, expected, reason, count)
