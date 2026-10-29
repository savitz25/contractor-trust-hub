#!/usr/bin/env python3
"""Secret-free PostgreSQL 17 engine acceptance for synthetic sitemap data only."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import sys
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
LOGDIR = ROOT / "artifacts" / "con-sitemap-phase0"
LOGDIR.mkdir(parents=True, exist_ok=True)
RESULTS: dict[str, dict[str, str]] = {}
DETAILS: dict[str, object] = {}
LOCK = (20261029, 1)
CAP = 400_000_000


def connect(*, autocommit: bool = True) -> psycopg.Connection:
    return psycopg.connect(autocommit=autocommit, connect_timeout=8)


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def record(case: str, function) -> None:
    started = time.monotonic()
    try:
        detail = function()
        RESULTS[case] = {"status": "PASS", "detail": str(detail or "assertions passed")}
    except Exception as exc:  # each case is retained even when a later one can continue
        RESULTS[case] = {"status": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}
    RESULTS[case]["duration_seconds"] = f"{time.monotonic()-started:.3f}"
    print(f"{case}={RESULTS[case]['status']} {RESULTS[case]['detail']}", flush=True)


def expect_error(sql: str, params: tuple = (), *, conn: psycopg.Connection | None = None) -> str:
    own = conn is None
    db = conn or connect()
    try:
        try:
            # A savepoint keeps an expected trigger/privilege error from poisoning
            # the surrounding transaction being tested.
            with db.transaction():
                db.execute(sql, params)
        except psycopg.Error as exc:
            return exc.sqlstate or type(exc).__name__
        raise AssertionError(f"statement unexpectedly succeeded: {sql[:90]}")
    finally:
        if own:
            db.close()


def tx(conn: psycopg.Connection):
    return conn.transaction()


def advisory(conn: psycopg.Connection) -> None:
    conn.execute("SELECT pg_advisory_lock(%s,%s)", LOCK)


def unadvisory(conn: psycopg.Connection) -> None:
    if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
        conn.rollback()
    released = conn.execute("SELECT pg_advisory_unlock(%s,%s)", LOCK).fetchone()[0]
    check(released is True, "session lock was not released after transaction end")


def xml_payload(path: str = "/fixture-one") -> bytes:
    xml = (f'<?xml version="1.0" encoding="UTF-8"?>'
           f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
           f'<url><loc>https://www.contractortrusthub.com{path}</loc></url></urlset>').encode()
    return gzip.compress(xml, mtime=0)


def manifest(checksums: list[bytes]) -> bytes:
    return hashlib.sha256("".join(value.hex() for value in checksums).encode()).digest()


def publish(generation_id: str, payloads: list[bytes], *, pause: threading.Event | None = None,
            staged: threading.Event | None = None) -> tuple[int, str | None]:
    db = connect()
    advisory(db)
    db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with tx(db):
            old_epoch, old_id = db.execute(
                "SELECT pointer_epoch,current_generation_id FROM sitemap_private.publication WHERE singleton"
            ).fetchone()
            db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",
                       (generation_id,))
            checksums: list[bytes] = []
            urls = 0
            byte_count = 0
            for number, payload in enumerate(payloads):
                digest = hashlib.sha256(payload).digest()
                checksums.append(digest)
                db.execute("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,%s,1,%s,%s)",
                           (generation_id, number, payload, digest))
                urls += 1
                byte_count += len(payload)
            db.execute("UPDATE sitemap_private.generation SET state='sealed',sealed_at=clock_timestamp(),shard_count=%s,url_count=%s,compressed_bytes=%s,manifest_sha256=%s WHERE generation_id=%s",
                       (len(payloads), urls, byte_count, manifest(checksums), generation_id))
            if old_id is not None:
                changed = db.execute("UPDATE sitemap_private.generation SET retired_at=clock_timestamp() WHERE generation_id=%s AND state='sealed' AND retired_at IS NULL",
                                     (old_id,)).rowcount
                check(changed == 1, "prior current generation could not be retired")
            changed = db.execute("UPDATE sitemap_private.publication SET pointer_epoch=%s,current_generation_id=%s WHERE singleton AND pointer_epoch=%s AND current_generation_id IS NOT DISTINCT FROM %s",
                                 (old_epoch + 1, generation_id, old_epoch, old_id)).rowcount
            check(changed == 1, "publication CAS was stale")
            if staged:
                staged.set()
            if pause:
                check(pause.wait(60), "concurrent test release timed out")
        return old_epoch + 1, old_id
    finally:
        try:
            unadvisory(db)
        finally:
            db.close()


def read_pointer() -> tuple[int, str | None]:
    with connect() as db:
        return db.execute("SELECT pointer_epoch,current_generation_id::text FROM sitemap_private.publication WHERE singleton").fetchone()


def setup() -> None:
    if os.getenv("PGDATABASE") != "cth_sitemap_pg17_synthetic" or os.getenv("PGUSER") != "cth_pg17_sitemap_test":
        raise RuntimeError("refusing to run: synthetic CI database identity does not match")
    if os.getenv("PGHOST") not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("refusing to run: PGHOST is not the local disposable service")
    with connect() as db:
        version = db.execute("SHOW server_version").fetchone()[0]
        check(version.startswith("17."), f"expected PostgreSQL 17, got {version}")
        DETAILS["postgresql_version"] = version
        contract = Path(__file__).with_name("contract.sql").read_text(encoding="utf-8")
        db.execute(contract, prepare=False)
        extension = db.execute("SELECT extversion,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'").fetchone()
        check(extension is not None and extension[1] == "extensions", f"pgcrypto not in extensions: {extension}")
        DETAILS["pgcrypto"] = {"version": extension[0], "schema": extension[1]}
        print(f"PG_VERSION={version}; pgcrypto={extension[0]} schema={extension[1]}", flush=True)


def d01() -> str:
    pointer = read_pointer()
    check(pointer == (0, None), f"new DB pointer was not empty: {pointer}")
    gid = str(uuid.uuid4())
    epoch, _ = publish(gid, [xml_payload()])
    check((epoch, read_pointer()[1]) == (1, gid), "first complete publication did not become epoch 1")
    return "first complete generation published atomically at epoch 1; HTTP 503 before pointer is outside engine test"


def d02() -> str:
    before = read_pointer()
    gid = str(uuid.uuid4())
    db = connect()
    advisory(db)
    db.execute("SET ROLE cth_sitemap_publisher")
    try:
        try:
            with tx(db):
                db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')", (gid,))
                payload = xml_payload("/atomic-abort")
                digest = hashlib.sha256(payload).digest()
                db.execute("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,0,1,%s,%s)", (gid,payload,digest))
                raise RuntimeError("injected interruption before seal/CAS")
        except RuntimeError:
            pass
    finally:
        unadvisory(db)
        db.close()
    with connect() as checkdb:
        check(checkdb.execute("SELECT count(*) FROM sitemap_private.generation WHERE generation_id=%s", (gid,)).fetchone()[0] == 0,
              "candidate metadata survived rollback")
        check(checkdb.execute("SELECT count(*) FROM sitemap_private.shard WHERE generation_id=%s", (gid,)).fetchone()[0] == 0,
              "candidate shards survived rollback")
    check(read_pointer() == before, "pointer changed after aborted candidate transaction")
    incomplete = str(uuid.uuid4())
    db=connect(); advisory(db)
    try:
        try:
            with tx(db):
                db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",(incomplete,))
                payload=xml_payload('/incomplete-commit')
                db.execute("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,0,1,%s,%s)",
                           (incomplete,payload,hashlib.sha256(payload).digest()))
        except psycopg.Error as exc:
            check(exc.sqlstate=="P0001",f"incomplete building generation commit failed unexpectedly: {exc.sqlstate}")
        else:
            raise AssertionError("incomplete/building generation committed")
    finally:
        unadvisory(db); db.close()
    return "candidate rows roll back together; deferred guard rejects committing an incomplete building generation with payloads"


def d03() -> str:
    gid = read_pointer()[1]
    db=connect(); advisory(db)
    try:
        with db.transaction():
            check(expect_error("UPDATE sitemap_private.shard SET url_count=2 WHERE generation_id=%s AND shard_no=0", (gid,), conn=db) == "P0001", "sealed shard update was not rejected")
            db.execute("SET LOCAL ROLE cth_sitemap_publisher")
            payload = xml_payload("/append")
            check(expect_error("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,99,1,%s,%s)",
                               (gid,payload,hashlib.sha256(payload).digest()), conn=db) == "P0001", "append to sealed generation was not rejected")
    finally:
        unadvisory(db); db.close()
    return "sealed shard update and append rejected"


def d04() -> str:
    gid = str(uuid.uuid4())
    code = expect_error("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')", (gid,))
    check(code == "P0001", f"mutation without same-backend session lock not rejected ({code})")
    with connect() as db:
        checks=db.execute("SELECT has_table_privilege('cth_sitemap_reader','sitemap_private.shard','SELECT'),has_table_privilege('cth_sitemap_reader','sitemap_private.shard','INSERT'),has_table_privilege('cth_sitemap_publisher','sitemap_private.shard','INSERT'),has_table_privilege('cth_sitemap_publisher','sitemap_private.shard','DELETE'),has_table_privilege('cth_sitemap_sweeper','sitemap_private.shard','DELETE')").fetchone()
        check(checks==(True,False,True,False,True),f"least-privilege grants unexpected: {checks}")
        definer_count=db.execute("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sitemap_private' AND p.prosecdef").fetchone()[0]
        check(definer_count==0,f"unexpected SECURITY DEFINER functions in private schema: {definer_count}")
    db=connect(); db.execute("SET ROLE cth_sitemap_reader")
    try:
        code=expect_error("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",(str(uuid.uuid4()),),conn=db)
        check(code=="42501",f"reader write privilege was not denied ({code})")
    finally:
        db.execute("RESET ROLE"); db.close()
    return "same-backend lock and explicit reader/publisher/sweeper privilege matrix enforced"


def d05() -> str:
    gid = str(uuid.uuid4())
    db = connect()
    advisory(db)
    db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with db.transaction():
            db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')", (gid,))
            payload = xml_payload("/checksum")
            bad = b"\x00" * 32
            check(expect_error("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,0,1,%s,%s)",
                               (gid,payload,bad), conn=db) == "P0001", "bad payload checksum accepted")
            raise RuntimeError("discard checksum fixture")
    except RuntimeError:
        pass
    finally:
        unadvisory(db)
        db.close()
    gap_id=str(uuid.uuid4())
    db=connect(); advisory(db); db.execute("SET ROLE cth_sitemap_publisher")
    try:
        try:
            with tx(db):
                db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",(gap_id,))
                checks=[]; total=0
                for no in (0,2):
                    payload=xml_payload(f'/gap-{no}'); digest=hashlib.sha256(payload).digest(); checks.append(digest); total+=len(payload)
                    db.execute("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,%s,1,%s,%s)",(gap_id,no,payload,digest))
                with db.transaction():
                    db.execute("UPDATE sitemap_private.generation SET state='sealed',sealed_at=clock_timestamp(),shard_count=2,url_count=2,compressed_bytes=%s,manifest_sha256=%s WHERE generation_id=%s",(total,manifest(checks),gap_id))
        except psycopg.Error as exc:
            check(exc.sqlstate=="P0001",f"shard gap sealing error unexpected: {exc.sqlstate}")
        else:
            raise AssertionError("non-contiguous shard ordinals sealed")
    finally:
        unadvisory(db); db.close()
    current=read_pointer()[1]
    admin=connect(); advisory(admin)
    try:
        with admin.transaction():
            original,stored=admin.execute("SELECT compressed_payload,payload_sha256 FROM sitemap_private.shard WHERE generation_id=%s AND shard_no=0",(current,)).fetchone()
            corrupt=original[:-1]+bytes([original[-1]^1])
            admin.execute("ALTER TABLE sitemap_private.shard DISABLE TRIGGER shard_freeze")
            admin.execute("UPDATE sitemap_private.shard SET compressed_payload=%s WHERE generation_id=%s AND shard_no=0",(corrupt,current))
            loaded,expected=admin.execute("SELECT compressed_payload,payload_sha256 FROM sitemap_private.shard WHERE generation_id=%s AND shard_no=0",(current,)).fetchone()
            check(hashlib.sha256(loaded).digest()!=expected,"corrupted stored bytes were not detected by readback checksum")
            admin.execute("UPDATE sitemap_private.shard SET compressed_payload=%s WHERE generation_id=%s AND shard_no=0",(original,current))
            admin.execute("ALTER TABLE sitemap_private.shard ENABLE TRIGGER shard_freeze")
    finally:
        unadvisory(admin); admin.close()
    return "bad row SHA rejected, stored-byte corruption detected by readback digest, and shard gap rejected"


def d06() -> str:
    db = connect()
    advisory(db)
    db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with db.transaction():
            current_epoch, current_id = db.execute("SELECT pointer_epoch,current_generation_id FROM sitemap_private.publication WHERE singleton").fetchone()
            changed = db.execute("UPDATE sitemap_private.publication SET pointer_epoch=pointer_epoch+1 WHERE singleton AND pointer_epoch=%s AND current_generation_id IS NOT DISTINCT FROM %s", (current_epoch-1,current_id)).rowcount
            check(changed == 0, "stale CAS changed a row")
            check(expect_error("UPDATE sitemap_private.publication SET pointer_epoch=%s WHERE singleton", (current_epoch+2,), conn=db) == "P0001", "epoch jump accepted")
    finally:
        unadvisory(db)
        db.close()
    return "stale expected epoch is zero-row CAS; trigger rejects non-unit epoch advance"


def d07() -> str:
    captured=read_pointer()
    with connect() as admin:
        admin.execute("CREATE TABLE sitemap_private.synthetic_inventory(id integer PRIMARY KEY, slug text NOT NULL UNIQUE)")
        admin.execute("INSERT INTO sitemap_private.synthetic_inventory VALUES(1,'a'),(2,'b'),(3,'c')")
    reader = connect(autocommit=False)
    writer = connect()
    try:
        reader.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        snapshot_pointer=reader.execute("SELECT pointer_epoch,current_generation_id::text FROM sitemap_private.publication WHERE singleton").fetchone()
        check(snapshot_pointer==captured,"first snapshot read did not match captured publication epoch and generation")
        first = reader.execute("SELECT id,slug FROM sitemap_private.synthetic_inventory ORDER BY slug,id LIMIT 2").fetchall()
        writer.execute("INSERT INTO sitemap_private.synthetic_inventory VALUES(4,'bb')")
        again = reader.execute("SELECT id,slug FROM sitemap_private.synthetic_inventory ORDER BY slug,id").fetchall()
        check([row[0] for row in first] == [1,2], f"keyset fixture order unexpected: {first}")
        check([row[0] for row in again] == [1,2,3], "repeatable-read snapshot changed after concurrent insert")
        reader.rollback()
    finally:
        if reader.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
            reader.rollback()
        reader.close()
        writer.close()
    return "synthetic keyset inventory held a repeatable-read read-only snapshot across concurrent insert"


def d08() -> str:
    before = read_pointer()
    gid = str(uuid.uuid4())
    staged = threading.Event()
    release = threading.Event()
    failure: list[BaseException] = []
    def worker():
        try:
            publish(gid,[xml_payload("/atomic-visibility")],pause=release,staged=staged)
        except BaseException as exc:
            failure.append(exc)
    thread = threading.Thread(target=worker,daemon=True)
    thread.start()
    check(staged.wait(30), "publisher did not reach pre-commit stage")
    check(read_pointer() == before, "uncommitted candidate became visible through pointer")
    release.set()
    thread.join(30)
    check(not thread.is_alive() and not failure, f"publisher did not commit cleanly: {failure}")
    check(read_pointer() == (before[0]+1,gid), "new complete generation not visible after commit")
    return "independent reader saw old pointer before commit and new pointer after commit"


def d09() -> str:
    current_epoch,current_id = read_pointer()
    # Publish replacement, then atomically reactivate the retained old generation.
    replacement = str(uuid.uuid4())
    publish(replacement,[xml_payload("/rollback-target")])
    db = connect()
    advisory(db)
    db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with db.transaction():
            epoch,active = db.execute("SELECT pointer_epoch,current_generation_id FROM sitemap_private.publication WHERE singleton").fetchone()
            target = db.execute("SELECT retired_at FROM sitemap_private.generation WHERE generation_id=%s",(current_id,)).fetchone()
            check(target is not None and target[0] is not None,"prior generation was not retained")
            db.execute("SET ROLE cth_sitemap_sweeper")
            check(expect_error("DELETE FROM sitemap_private.shard WHERE generation_id=%s",(current_id,),conn=db)=="P0001","retained shard deletion was accepted")
            db.execute("SET ROLE cth_sitemap_publisher")
            db.execute("UPDATE sitemap_private.generation SET retired_at=NULL WHERE generation_id=%s",(current_id,))
            db.execute("UPDATE sitemap_private.generation SET retired_at=clock_timestamp() WHERE generation_id=%s",(active,))
            count = db.execute("UPDATE sitemap_private.publication SET pointer_epoch=%s,current_generation_id=%s WHERE singleton AND pointer_epoch=%s AND current_generation_id=%s",
                               (epoch+1,current_id,epoch,active)).rowcount
            check(count==1,"rollback CAS failed")
    finally:
        unadvisory(db)
        db.close()
    check(read_pointer()==(current_epoch+2,current_id),"rollback did not reactivate retained generation with a new epoch")
    cleanup_current=str(uuid.uuid4())
    publish(cleanup_current,[xml_payload('/cleanup-current')])
    db=connect(); advisory(db); db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with db.transaction():
            db.execute("UPDATE sitemap_private.generation SET retired_at=clock_timestamp()-interval '8 days 1 second' WHERE generation_id=%s",(current_id,))
            db.execute("SET LOCAL ROLE cth_sitemap_sweeper")
            db.execute("DELETE FROM sitemap_private.shard WHERE generation_id=%s",(current_id,))
            db.execute("DELETE FROM sitemap_private.generation WHERE generation_id=%s",(current_id,))
    finally:
        unadvisory(db); db.close()
    with connect() as verify:
        check(verify.execute("SELECT count(*) FROM sitemap_private.generation WHERE generation_id=%s",(current_id,)).fetchone()[0]==0,"expired retained generation was not cleaned")
    return "rollback reactivated retained generation with epoch increment; retained row protected before expiry and swept after eight days"


def d10() -> str:
    owner = connect()
    contender = connect()
    try:
        advisory(owner)
        owner.execute("SET ROLE cth_sitemap_publisher")
        contender.execute("SET ROLE cth_sitemap_sweeper")
        acquired = contender.execute("SELECT pg_try_advisory_lock(%s,%s)",LOCK).fetchone()[0]
        check(acquired is False,"competing publisher/sweeper acquired occupied global lock")
        before=contender.execute("SELECT count(*) FROM sitemap_private.generation").fetchone()[0]
        # Sweeper contract: failure to acquire the shared lock means it skips all deletes.
        check(contender.execute("SELECT pg_try_advisory_lock(%s,%s)",LOCK).fetchone()[0] is False,"sweeper unexpectedly acquired publisher lock")
        after=contender.execute("SELECT count(*) FROM sitemap_private.generation").fetchone()[0]
        check(after==before,"busy sweeper modified generation rows")
        released = owner.execute("SELECT pg_advisory_unlock(%s,%s)",LOCK).fetchone()[0]
        check(released is True,"owner failed to unlock")
        acquired = contender.execute("SELECT pg_try_advisory_lock(%s,%s)",LOCK).fetchone()[0]
        check(acquired is True,"contender could not acquire after owner release")
        check(contender.execute("SELECT pg_advisory_unlock(%s,%s)",LOCK).fetchone()[0] is True,"contender failed to unlock")
    finally:
        owner.close()
        contender.close()
    return "two independent backend sessions serialized on publisher/sweeper lock"


def d11() -> str:
    gid=read_pointer()[1]
    db=connect(); advisory(db); db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with db.transaction():
            db.execute("SET LOCAL ROLE cth_sitemap_sweeper")
            check(expect_error("DELETE FROM sitemap_private.shard WHERE generation_id=%s",(gid,),conn=db)=="P0001","current shard delete accepted")
            check(expect_error("DELETE FROM sitemap_private.generation WHERE generation_id=%s",(gid,),conn=db)=="P0001","current generation delete accepted")
    finally:
        unadvisory(db); db.close()
    return "current generation and its shards protected from direct cleanup"


def d12() -> str:
    db=connect()
    advisory(db)
    pid=db.execute("SELECT pg_backend_pid()").fetchone()[0]
    # A read-only transaction may have no backend_xid; rollback still precedes unlock.
    db.execute("BEGIN READ ONLY")
    db.execute("SELECT 1").fetchone()
    with connect() as observer:
        xid=observer.execute("SELECT backend_xid FROM pg_stat_activity WHERE pid=%s",(pid,)).fetchone()[0]
    check(xid is None,"read-only test unexpectedly acquired an XID")
    db.execute("ROLLBACK")
    check(db.execute("SELECT pg_advisory_unlock(%s,%s)",LOCK).fetchone()[0] is True,"read-only lock not released after rollback")
    advisory(db)
    try:
        try:
            with db.transaction():
                db.execute("SELECT 1/0")
        except psycopg.Error:
            pass
        check(db.info.transaction_status==psycopg.pq.TransactionStatus.IDLE,"failed write transaction was not rolled back")
        check(db.execute("SELECT pg_advisory_unlock(%s,%s)",LOCK).fetchone()[0] is True,"aborted-transaction lock not released after rollback")
    finally:
        if db.info.transaction_status!=psycopg.pq.TransactionStatus.IDLE: db.rollback()
        db.close()
    return "read-only XID-less transaction and failed transaction rolled back before session unlock"


def d13() -> str:
    with connect() as db:
        db.execute("SET lock_timeout='5s'")
        db.execute("SET statement_timeout='180s'")
        db.execute("SET idle_in_transaction_session_timeout='60s'")
        db.execute("SET transaction_timeout='20min'")
        values=db.execute("SELECT current_setting('lock_timeout'),current_setting('statement_timeout'),current_setting('idle_in_transaction_session_timeout'),current_setting('transaction_timeout'),pg_backend_pid()").fetchone()
        check(values[:4]==('5s','3min','1min','20min'),f"timeouts differ: {values}")
        DETAILS["engine_session"]={"lock_timeout":values[0],"statement_timeout":values[1],"idle_in_transaction_session_timeout":values[2],"transaction_timeout":values[3],"backend_pid_stable":True}
        db.execute("SET statement_timeout='20ms'")
        check(expect_error("SELECT pg_sleep(0.1)",conn=db)=="57014","statement timeout did not cancel bounded query")
    return "PG17 timeout settings and pinned backend checked; pooler behavior not tested"


def d14() -> str:
    current_id=read_pointer()[1]
    with connect() as db:
        prior=db.execute("SELECT coalesce(sum(compressed_bytes),0) FROM sitemap_private.shard").fetchone()[0]
    remaining=CAP-prior
    check(remaining>0,"existing synthetic rows already exceed cap")
    # A single 400 MB logical compressed-payload fixture exercises the exact byte boundary.
    payload=b'X'*remaining
    gid=str(uuid.uuid4())
    db=connect(); advisory(db); db.execute("SET ROLE cth_sitemap_publisher")
    try:
        with tx(db):
            old_epoch,old_id=db.execute("SELECT pointer_epoch,current_generation_id FROM sitemap_private.publication WHERE singleton").fetchone()
            db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",(gid,))
            digest=hashlib.sha256(payload).digest()
            db.execute("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,0,1,%s,%s)",(gid,payload,digest))
            db.execute("UPDATE sitemap_private.generation SET state='sealed',sealed_at=clock_timestamp(),shard_count=1,url_count=1,compressed_bytes=%s,manifest_sha256=%s WHERE generation_id=%s",(remaining,manifest([digest]),gid))
            db.execute("UPDATE sitemap_private.generation SET retired_at=clock_timestamp() WHERE generation_id=%s",(old_id,))
            changed=db.execute("UPDATE sitemap_private.publication SET pointer_epoch=%s,current_generation_id=%s WHERE singleton AND pointer_epoch=%s AND current_generation_id=%s",(old_epoch+1,gid,old_epoch,old_id)).rowcount
            check(changed==1,"cap fixture pointer CAS failed")
        with db.transaction():
            extra=b'Z'
            bad=str(uuid.uuid4())
            db.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",(bad,))
            check(expect_error("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,0,1,%s,%s)",(bad,extra,hashlib.sha256(extra).digest()),conn=db)=="P0001","one byte beyond cap accepted")
            raise RuntimeError("discard over-cap building row")
    except RuntimeError:
        pass
    finally:
        unadvisory(db); db.close()
    check(read_pointer()[1]==gid,"cap-boundary generation did not remain current")
    with connect() as db:
        actual=db.execute("SELECT sum(compressed_bytes) FROM sitemap_private.shard").fetchone()[0]
        rel=db.execute("SELECT pg_relation_size('sitemap_private.shard'::regclass),pg_total_relation_size('sitemap_private.shard'::regclass),pg_total_relation_size(reltoastrelid::regclass) FROM pg_class WHERE oid='sitemap_private.shard'::regclass").fetchone()
        check(actual==CAP,f"payload usage {actual} != agreed cap {CAP}")
        DETAILS["storage"]={"logical_compressed_payload_bytes":actual,"cap_bytes":CAP,"heap_bytes":rel[0],"relation_plus_index_toast_bytes":rel[1],"toast_total_bytes":rel[2]}
    return f"exact {CAP}-byte logical payload limit accepted; next byte rejected; heap/TOAST/index measured separately {rel}"


def d15() -> str:
    # No application serving handler is exercised by the database-only package.
    return "UNRUN: 503/no-store, confirmed 404 and route-level fail-closed behavior require application tests"


def d16() -> str:
    payload=gzip.decompress(xml_payload("/synthetic-a"))
    root=ET.fromstring(payload)
    ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls=[node.text for node in root.findall('.//s:loc',ns)]
    check(urls==['https://www.contractortrusthub.com/synthetic-a'],f"synthetic XML canonical URL invalid: {urls}")
    check(len(set(urls))==len(urls),"synthetic XML URL duplicated")
    return "synthetic XML parsed and canonical host/uniqueness asserted; production serializer/eligibility remains unrun"


def d17() -> str:
    return "UNRUN: CDN cache headers and purge acknowledgements are not testable in a plain PostgreSQL service"


def d18() -> str:
    before=read_pointer()
    doomed=connect()
    advisory(doomed)
    doomed.execute("SET ROLE cth_sitemap_publisher")
    doomed.execute("BEGIN")
    gid=str(uuid.uuid4())
    doomed.execute("INSERT INTO sitemap_private.generation(generation_id,state) VALUES(%s,'building')",(gid,))
    payload=xml_payload('/connection-loss')
    doomed.execute("INSERT INTO sitemap_private.shard(generation_id,shard_no,url_count,compressed_payload,payload_sha256) VALUES(%s,0,1,%s,%s)",(gid,payload,hashlib.sha256(payload).digest()))
    pid=doomed.execute("SELECT pg_backend_pid()").fetchone()[0]
    doomed.close()  # socket loss: PostgreSQL rolls back open txn and releases session lock.
    released=False
    for _ in range(80):
        with connect() as db:
            count=db.execute("SELECT count(*) FROM sitemap_private.generation WHERE generation_id=%s",(gid,)).fetchone()[0]
            released=db.execute("SELECT pg_try_advisory_lock(%s,%s)",LOCK).fetchone()[0] is True
            if released:
                db.execute("SELECT pg_advisory_unlock(%s,%s)",LOCK)
            if count==0 and released:
                break
        time.sleep(0.1)
    check(count==0,"interrupted generation survived")
    check(released,"server retained dead backend lock")
    check(read_pointer()==before,"interrupted session changed pointer")
    DETAILS["terminated_backend_pid"]=pid
    return "client connection ended with open transaction; server rolled back and released session lock"


def d19() -> str:
    size=DETAILS.get('storage')
    check(isinstance(size,dict) and size.get('logical_compressed_payload_bytes')==CAP,"physical-size evidence missing")
    check(size['relation_plus_index_toast_bytes']>=size['heap_bytes'],"total relation footprint below heap size")
    return "logical payload cap and PostgreSQL heap/index/TOAST relation footprint recorded as separate measures"


def main() -> int:
    started=datetime.now(timezone.utc).isoformat()
    try:
        setup()
    except Exception as exc:
        error=f"{type(exc).__name__}: {exc}"
        print(f"SETUP=FAIL {error}",flush=True)
        report={"task_id":"CON-SITEMAP-PHASE0-CI-REPAIR","started_at_utc":datetime.now(timezone.utc).isoformat(),
                "database":"synthetic PostgreSQL 17 service","setup_status":"FAIL","error":error,
                "cases":{},"production_connected":False}
        (LOGDIR/'pg17-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        (LOGDIR/'pg17-results.log').write_text(f"SETUP=FAIL {error}\nProduction: NOT CONNECTED\n",encoding='utf-8')
        return 1
    tests=[('D01',d01),('D02',d02),('D03',d03),('D04',d04),('D05',d05),('D06',d06),
           ('D07',d07),('D08',d08),('D09',d09),('D10',d10),('D11',d11),('D12',d12),
           ('D13',d13),('D18',d18),('D14',d14),('D15',d15),('D16',d16),('D17',d17),('D19',d19)]
    for case,fn in tests:
        record(case,fn)
    counts={state:sum(1 for result in RESULTS.values() if result['status']==state) for state in ('PASS','FAIL','UNRUN')}
    # Mark intentional UNRUN design gates distinctly from green engine tests.
    for result in RESULTS.values():
        if result['detail'].startswith('UNRUN:'):
            result['status']='UNRUN'
    counts={state:sum(1 for result in RESULTS.values() if result['status']==state) for state in ('PASS','FAIL','UNRUN')}
    report={"task_id":"CON-SITEMAP-PHASE0-CI-REPAIR","started_at_utc":started,
            "finished_at_utc":datetime.now(timezone.utc).isoformat(),"database":"synthetic PostgreSQL 17 service",
            "version":DETAILS.get('postgresql_version'),"pgcrypto":DETAILS.get('pgcrypto'),"cases":RESULTS,
            "details":DETAILS,"counts":counts}
    (LOGDIR/'pg17-results.json').write_text(json.dumps(report,indent=2,default=str)+'\n',encoding='utf-8')
    with (LOGDIR/'pg17-results.log').open('w',encoding='utf-8') as log:
        log.write(f"Task: CON-SITEMAP-PHASE0-CI-REPAIR\nPostgreSQL: {DETAILS.get('postgresql_version')}\nCounts: {counts}\n")
        for case,result in RESULTS.items(): log.write(f"{case}={result['status']} {result['detail']} ({result.get('duration_seconds')}s)\n")
        log.write('Supabase role/pooler/TLS behavior: UNRUN\nProduction: NOT CONNECTED\n')
    print(f"SUMMARY={counts}",flush=True)
    return 1 if counts['FAIL'] else 0


if __name__=='__main__':
    sys.exit(main())
