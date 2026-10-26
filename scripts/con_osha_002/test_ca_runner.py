"""Focused tests for the California execution wrapper. No database and no Production write."""

from __future__ import annotations

import hashlib
import inspect
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock
from uuid import UUID

from scripts.con_osha_002.ca_runner import (
    DIRECT_HOST,
    FROZEN_BATCH_ID,
    GO_PHRASE,
    NIL_BATCH,
    SESSION_HOST,
    SESSION_PORT,
    SESSION_USER,
    assert_writer_url,
    database_url_for_writer,
    explain_connection_failure,
    main,
    parse_args,
    redact,
    rollback_plan,
    run_write,
    session_target_from_app_url,
    verify_founder_authorization,
)
from scripts.con_osha_002.contract import (
    CERTIFIED_CITATIONS,
    CERTIFIED_ELIGIBLE_PROFILES,
    CERTIFIED_PUBLISHED_ACTIVITIES,
)
from scripts.con_osha_002.eligibility import LoadError
from scripts.con_osha_002.execute import _run_write

ROOT = Path(__file__).resolve().parents[2]
APP_URL = (
    "postgresql://postgres.jhjztnisugdsuliriajp:secr%40t"
    "@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
)
IPV4 = "192.0.2.10"
VERIFY = (
    "https://github.com/savitz25/contractor-trust-hub/issues/171#issuecomment-1001"
)


def _founder(directory: Path, text: str) -> Path:
    path = directory / "founder-ca.txt"
    path.write_text(text, encoding="utf-8")
    return path


def _env(directory: Path, url: str = APP_URL) -> Path:
    path = directory / "env.local"
    path.write_text(f"DATABASE_URL={url}\n", encoding="utf-8")
    return path


def _published(text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return (
        "2026-10-24\n"
        "The Founder authorizes the CON-OSHA-002 California production load.\n"
        f"sha256 {digest}\n"
    )


class CaliforniaRunnerTests(unittest.TestCase):
    def test_default_mode_is_preflight_and_does_not_write(self):
        args = parse_args([])
        self.assertFalse(args.write)
        with mock.patch("scripts.con_osha_002.ca_runner.run_preflight", return_value={
            "mode": "preflight",
            "production_rows_written": 0,
            "session_database_connection": "READY",
        }) as preflight, mock.patch("scripts.con_osha_002.ca_runner.run_write") as writer, \
                redirect_stdout(io.StringIO()):
            code = main([])
        self.assertEqual(code, 0)
        preflight.assert_called_once()
        writer.assert_not_called()

    def test_approved_session_pooler_is_the_only_writer_target(self):
        target = session_target_from_app_url(APP_URL)
        self.assertEqual(target["host"], SESSION_HOST)
        self.assertEqual(target["port"], SESSION_PORT)
        self.assertEqual(target["user"], SESSION_USER)
        self.assertEqual(target["dbname"], "postgres")
        self.assertEqual(target["sslmode"], "require")
        target["ipv4"] = IPV4
        url = database_url_for_writer(target)
        assert_writer_url(url)
        self.assertIn(SESSION_HOST, url)
        self.assertIn("postgres.jhjztnisugdsuliriajp", url)
        self.assertIn("sslmode=require", url)
        self.assertIn(f"hostaddr={IPV4}", url)
        self.assertIn("secr%40t", url)
        self.assertNotIn(DIRECT_HOST, url)
        self.assertNotIn("6543", url)
        rejected = [
            APP_URL.replace(":5432/", ":6543/"),
            APP_URL.replace("sslmode=require", "sslmode=disable"),
            APP_URL.replace("?sslmode=require", ""),
            APP_URL.replace(SESSION_HOST, DIRECT_HOST).replace(
                "postgres.jhjztnisugdsuliriajp", "postgres"
            ),
            APP_URL.replace(SESSION_HOST, "aws-0-us-east-1.pooler.supabase.com"),
            APP_URL.replace("postgres.jhjztnisugdsuliriajp", "postgres.otherproject"),
            APP_URL.replace("/postgres?", "/template1?"),
        ]
        for bad in rejected:
            with self.assertRaises(LoadError):
                session_target_from_app_url(bad)
        with self.assertRaises(LoadError):
            assert_writer_url(url.replace(":5432/", ":6543/"))
        with self.assertRaises(LoadError):
            assert_writer_url(url.replace(SESSION_HOST, DIRECT_HOST))
        with self.assertRaises(LoadError):
            assert_writer_url(url.replace("sslmode=require", "sslmode=disable"))
        with self.assertRaises(LoadError):
            assert_writer_url(url.replace(f"hostaddr={IPV4}", "hostaddr=2001:db8::1"))
        with self.assertRaises(LoadError):
            database_url_for_writer({**target, "ipv4": ""})

    def test_local_authorization_file_is_not_founder_permission(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = _founder(
                root,
                "2026-10-24\nThe Founder authorizes the CON-OSHA-002 California production load.\n",
            )
            phrase_only = _founder(root, GO_PHRASE + "\n")
            env = _env(root)
            with mock.patch("scripts.con_osha_002.ca_runner.build_plans") as plans, \
                    mock.patch("scripts.con_osha_002.ca_runner.execute_load") as writer, \
                    mock.patch("scripts.con_osha_002.ca_runner.fetch_github_comment") as fetched:
                with self.assertRaises(LoadError) as missing:
                    run_write(local, GO_PHRASE, env, mock.Mock())
                with self.assertRaises(LoadError):
                    run_write(phrase_only, GO_PHRASE, env, mock.Mock())
            self.assertIn("not Founder permission", str(missing.exception))
            plans.assert_not_called()
            writer.assert_not_called()
            fetched.assert_not_called()

    def test_unverified_github_comment_does_not_authorize_a_write(self):
        text = (
            "2026-10-24\n"
            "The Founder authorizes the CON-OSHA-002 California production load.\n"
            f"Independent-Verification: {VERIFY}\n"
        )
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = _founder(root, text)
            env = _env(root)
            with mock.patch("scripts.con_osha_002.ca_runner.fetch_github_comment", return_value={
                "author": "someone-else",
                "body": _published(text),
            }), mock.patch("scripts.con_osha_002.ca_runner.build_plans") as plans, \
                    mock.patch("scripts.con_osha_002.ca_runner.execute_load") as writer:
                with self.assertRaises(LoadError):
                    run_write(path, GO_PHRASE, env, mock.Mock())
            plans.assert_not_called()
            writer.assert_not_called()

    def test_write_delegates_to_execute_load_only_after_all_gates(self):
        calls = {}

        def fake_execute_load(*args, **kwargs):
            calls["args"] = args
            calls["kwargs"] = kwargs
            return {"mode": "loaded"}

        plans = mock.Mock()
        plans.eligibility = object()
        plans.detail = object()
        plans.identities = {"mapped": "1"}
        plans.package_sha256 = "a" * 64
        text = (
            "2026-10-24\n"
            "The Founder authorizes the CON-OSHA-002 California production load.\n"
            f"Independent-Verification: {VERIFY}\n"
        )
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            founder = _founder(root, text)
            env = _env(root)
            with mock.patch("scripts.con_osha_002.ca_runner.fetch_github_comment", return_value={
                "author": "savitz25",
                "body": _published(text),
            }), mock.patch("scripts.con_osha_002.ca_runner.resolve_ipv4", return_value=IPV4), \
                    mock.patch("scripts.con_osha_002.ca_runner.build_plans", return_value=plans), \
                    mock.patch("scripts.con_osha_002.ca_runner.execute_load", fake_execute_load):
                with self.assertRaises(LoadError):
                    run_write(founder, "CON-OSHA-002-EXPANSION-LOAD-GO-EXTRA", env, mock.Mock())
                self.assertEqual(calls, {})
                result = run_write(founder, GO_PHRASE, env, mock.Mock())
                checked = verify_founder_authorization(
                    founder,
                    comment_fetcher=lambda _comment: {"author": "savitz25", "body": _published(text)},
                )
        self.assertEqual(result["mode"], "loaded")
        self.assertIs(calls["args"][0], plans.eligibility)
        self.assertIs(calls["args"][1], plans.detail)
        kwargs = calls["kwargs"]
        self.assertEqual(kwargs["confirm"], GO_PHRASE)
        self.assertEqual(kwargs["expected_db_host"], SESSION_HOST)
        self.assertEqual(kwargs["expected_db_name"], "postgres")
        self.assertEqual(kwargs["batch_id"], FROZEN_BATCH_ID)
        self.assertEqual(kwargs["expected_profiles"], CERTIFIED_ELIGIBLE_PROFILES["CA"])
        self.assertEqual(kwargs["expected_activities"], CERTIFIED_PUBLISHED_ACTIVITIES["CA"])
        self.assertEqual(kwargs["expected_citations"], CERTIFIED_CITATIONS["CA"])
        self.assertEqual(kwargs["expected_profiles"], 1706)
        self.assertEqual(kwargs["expected_activities"], 2615)
        self.assertEqual(kwargs["expected_citations"], 6903)
        self.assertTrue(kwargs["official"])
        self.assertNotIn("connector", kwargs)
        self.assertIn(SESSION_HOST, kwargs["database_url"])
        self.assertIn(SESSION_USER, kwargs["database_url"])
        self.assertIn("hostaddr=192.0.2.10", kwargs["database_url"])
        self.assertNotIn(DIRECT_HOST, kwargs["database_url"])
        self.assertNotIn("6543", kwargs["database_url"])
        self.assertEqual(checked["date"], "2026-10-24")
        self.assertEqual(checked["verification_url"], VERIFY)

    def test_frozen_batch_rollback_preserves_fl_nj_receipts(self):
        self.assertEqual(str(UUID(FROZEN_BATCH_ID)), FROZEN_BATCH_ID)
        self.assertNotEqual(FROZEN_BATCH_ID, NIL_BATCH)
        statement = rollback_plan()
        self.assertLess(
            statement.index("DELETE FROM contractor_osha_citations"),
            statement.index("DELETE FROM contractor_osha_match_inspections"),
        )
        self.assertLess(
            statement.index("DELETE FROM contractor_osha_match_inspections"),
            statement.index("DELETE FROM contractor_osha_inspections"),
        )
        self.assertNotIn("DELETE FROM contractors", statement)
        self.assertNotIn("DELETE FROM licenses", statement)
        self.assertNotIn("DELETE FROM osha_load_receipts", statement)
        self.assertIn(FROZEN_BATCH_ID, statement)
        source = inspect.getsource(_run_write)
        self.assertIn("with conn:", source)
        self.assertIn("rolling back", source)
        writer = (ROOT / "scripts" / "con_osha_002" / "execute.py").read_text(encoding="utf-8")
        self.assertNotIn("pooler.supabase.com", writer)
        self.assertIn("def execute_load(", writer)

    def test_receipt_redaction_and_publication_default(self):
        self.assertNotIn("secr@t", redact("password=secr@t host=db", "secr@t"))
        self.assertNotIn("postgresql://", redact("postgresql://postgres:secr@t@host/postgres"))
        explained = explain_connection_failure("OperationalError: getaddrinfo failed")
        self.assertIn("IPv4 session pooler", explained)
        self.assertIn("6543", explained)
        self.assertIn("not used as a fallback", explained)
        flag = (ROOT / "lib" / "osha" / "flag.ts").read_text(encoding="utf-8")
        self.assertIn('const DEFAULT_PUBLISHED_STATES = ["FL", "NJ"] as const;', flag)
        encoded = json.dumps({"production_rows_written": 0})
        self.assertIn('"production_rows_written": 0', encoded)

    def test_import_does_not_call_the_writer(self):
        source = (ROOT / "scripts" / "con_osha_002" / "ca_runner.py").read_text(encoding="utf-8")
        self.assertLess(source.index("def run_preflight"), source.index("def run_write"))
        self.assertIn("execute_load(", source[source.index("def run_write"):])
        self.assertNotIn("execute_load(", source[:source.index("def run_write")])
        self.assertNotIn("direct_target_from_app_url", source)


if __name__ == "__main__":
    unittest.main()
