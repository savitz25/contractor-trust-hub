#!/usr/bin/env python3
"""
Download official Florida Sunbiz (Division of Corporations) bulk files via SFTP.

Official public access (published by FL DOS):
  Host:     sftp.floridados.gov
  Username: Public
  Password: PubAccess1845!   (override with SUNBIZ_SFTP_PASSWORD)

Docs:
  https://dos.fl.gov/sunbiz/other-services/data-downloads/
  https://dos.fl.gov/sunbiz/other-services/data-downloads/quarterly-data/
  https://dos.fl.gov/sunbiz/other-services/data-downloads/daily-data/

Remote paths (case-sensitive on this server):
  Quarterly corporate data:  doc/Quarterly/Cor/cordata.zip   (~1.8 GB)
  Quarterly corporate events: doc/Quarterly/Cor/corevent.zip
  Daily corporate filings:   doc/cor/YYYYMMDDc.txt
  Daily corporate events:    doc/cor/events/YYYYMMDDce.txt

Usage:
  python scripts/download_sunbiz.py --list
  python scripts/download_sunbiz.py --daily-latest
  python scripts/download_sunbiz.py --daily 20260809
  python scripts/download_sunbiz.py --quarterly          # large download
  python scripts/download_sunbiz.py --quarterly --events
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "data" / "raw" / "sunbiz"

# Public credentials published by Florida Department of State
DEFAULT_HOST = "sftp.floridados.gov"
DEFAULT_USER = "Public"
DEFAULT_PASSWORD = "PubAccess1845!"

REMOTE = {
    "quarterly_cor_data": "doc/Quarterly/Cor/cordata.zip",
    "quarterly_cor_events": "doc/Quarterly/Cor/corevent.zip",
    "daily_cor_dir": "doc/cor",
    "daily_cor_events_dir": "doc/cor/events",
}

log = logging.getLogger("download_sunbiz")


def _require_paramiko():
    try:
        import paramiko
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "paramiko is required for SFTP downloads.\n"
            "  pip install 'paramiko>=3.4'\n"
            f"Original error: {exc}"
        ) from exc
    return paramiko


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def connect_sftp(
    host: str,
    username: str,
    password: str,
    *,
    port: int = 22,
    timeout: float = 60.0,
    retries: int = 3,
):
    paramiko = _require_paramiko()
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            log.info("SFTP connect %s@%s:%s (attempt %s/%s)", username, host, port, attempt, retries)
            transport = paramiko.Transport((host, port))
            transport.banner_timeout = timeout
            transport.auth_timeout = timeout
            transport.connect(username=username, password=password)
            sftp = paramiko.SFTPClient.from_transport(transport)
            if sftp is None:
                raise RuntimeError("SFTP client failed to start")
            sftp.get_channel().settimeout(timeout)
            return sftp, transport
        except Exception as exc:  # noqa: BLE001 — retry wrapper
            last_err = exc
            log.warning("Connect failed: %s", exc)
            time.sleep(min(2 ** attempt, 15))
    raise RuntimeError(f"SFTP connect failed after {retries} attempts: {last_err}")


def list_remote(sftp, path: str) -> list[str]:
    return sorted(sftp.listdir(path))


def download_file(
    sftp,
    remote_path: str,
    local_path: Path,
    *,
    retries: int = 3,
) -> dict[str, Any]:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = local_path.with_suffix(local_path.suffix + ".part")
    last_err: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            st = sftp.stat(remote_path)
            remote_size = int(st.st_size)
            log.info(
                "Downloading %s → %s (%s bytes, attempt %s/%s)",
                remote_path,
                local_path,
                remote_size,
                attempt,
                retries,
            )
            started = time.time()
            # Resume-friendly: rewrite part each attempt
            if tmp.exists():
                tmp.unlink()

            def _cb(transferred: int, total: int) -> None:
                if total and transferred % max(total // 20, 1) < 1024 * 1024:
                    pct = 100.0 * transferred / total
                    if transferred == total or transferred % (50 * 1024 * 1024) < 1024 * 1024:
                        log.info("  progress %.1f%% (%s / %s)", pct, transferred, total)

            sftp.get(remote_path, str(tmp), callback=_cb)
            if tmp.stat().st_size != remote_size:
                raise IOError(
                    f"Size mismatch: local {tmp.stat().st_size} != remote {remote_size}"
                )
            if local_path.exists():
                local_path.unlink()
            tmp.rename(local_path)
            elapsed = time.time() - started
            digest = sha256_file(local_path)
            meta = {
                "remote_path": remote_path,
                "local_path": str(local_path).replace("\\", "/"),
                "bytes": local_path.stat().st_size,
                "sha256": digest,
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "elapsed_seconds": round(elapsed, 2),
            }
            log.info("OK %s sha256=%s…", local_path.name, digest[:16])
            return meta
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            log.warning("Download failed: %s", exc)
            time.sleep(min(2 ** attempt, 20))

    raise RuntimeError(f"Failed to download {remote_path}: {last_err}")


def latest_daily_name(sftp, remote_dir: str, suffix: str = "c.txt") -> str:
    names = [
        n
        for n in list_remote(sftp, remote_dir)
        if n.endswith(suffix) and len(n) >= 8 and n[:8].isdigit()
    ]
    if not names:
        raise FileNotFoundError(f"No daily files matching *{suffix} in {remote_dir}")
    return sorted(names)[-1]


def write_manifest(out_dir: Path, entries: list[dict[str, Any]]) -> Path:
    path = out_dir / "download_manifest.json"
    existing: list[dict[str, Any]] = []
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(existing, list):
                existing = []
        except json.JSONDecodeError:
            existing = []
    # Replace by remote_path
    by_remote = {e.get("remote_path"): e for e in existing if isinstance(e, dict)}
    for e in entries:
        by_remote[e["remote_path"]] = e
    merged = list(by_remote.values())
    path.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    log.info("Wrote %s", path)
    return path


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Download Florida Sunbiz bulk files via SFTP")
    p.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    p.add_argument("--host", default=os.environ.get("SUNBIZ_SFTP_HOST", DEFAULT_HOST))
    p.add_argument("--user", default=os.environ.get("SUNBIZ_SFTP_USER", DEFAULT_USER))
    p.add_argument(
        "--password",
        default=os.environ.get("SUNBIZ_SFTP_PASSWORD", DEFAULT_PASSWORD),
        help="Public password is published by FL DOS; prefer env SUNBIZ_SFTP_PASSWORD",
    )
    p.add_argument("--timeout", type=float, default=120.0)
    p.add_argument("--retries", type=int, default=3)
    p.add_argument("--list", action="store_true", help="List remote quarterly/daily dirs and exit")
    p.add_argument("--daily-latest", action="store_true", help="Download newest daily corporate file")
    p.add_argument("--daily", metavar="YYYYMMDD", help="Download daily corporate file for date")
    p.add_argument("--daily-events", action="store_true", help="Also download daily events file")
    p.add_argument(
        "--quarterly",
        action="store_true",
        help="Download quarterly cordata.zip (~1.8GB) into data/raw/sunbiz/quarterly/",
    )
    p.add_argument("--events", action="store_true", help="With --quarterly, also corevent.zip")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    if not any([args.list, args.daily_latest, args.daily, args.quarterly]):
        # Sensible default for smoke tests: latest daily corporate filings
        args.daily_latest = True
        log.info("No mode selected — defaulting to --daily-latest")

    sftp, transport = connect_sftp(
        args.host,
        args.user,
        args.password,
        timeout=args.timeout,
        retries=args.retries,
    )
    entries: list[dict[str, Any]] = []
    try:
        if args.list:
            for path in [
                "doc/Quarterly/Cor",
                "doc/cor",
                "doc/cor/events",
            ]:
                try:
                    names = list_remote(sftp, path)
                    print(f"\n{path} ({len(names)} entries)")
                    for n in names[-15:]:
                        try:
                            st = sftp.stat(f"{path}/{n}")
                            print(f"  {n:40} {st.st_size:>12}")
                        except OSError:
                            print(f"  {n}")
                except OSError as exc:
                    print(f"\n{path}: {exc}")
            return 0

        out_dir: Path = args.out_dir
        out_dir.mkdir(parents=True, exist_ok=True)

        if args.quarterly:
            qdir = out_dir / "quarterly"
            meta = download_file(
                sftp,
                REMOTE["quarterly_cor_data"],
                qdir / "cordata.zip",
                retries=args.retries,
            )
            entries.append(meta)
            if args.events:
                meta = download_file(
                    sftp,
                    REMOTE["quarterly_cor_events"],
                    qdir / "corevent.zip",
                    retries=args.retries,
                )
                entries.append(meta)

        daily_dates: list[str] = []
        if args.daily_latest:
            name = latest_daily_name(sftp, REMOTE["daily_cor_dir"], "c.txt")
            daily_dates.append(name[:8])
        if args.daily:
            daily_dates.append(args.daily)

        for ymd in daily_dates:
            remote = f"{REMOTE['daily_cor_dir']}/{ymd}c.txt"
            local = out_dir / "daily" / f"{ymd}c.txt"
            entries.append(download_file(sftp, remote, local, retries=args.retries))
            if args.daily_events:
                remote_e = f"{REMOTE['daily_cor_events_dir']}/{ymd}ce.txt"
                local_e = out_dir / "daily" / f"{ymd}ce.txt"
                try:
                    entries.append(download_file(sftp, remote_e, local_e, retries=args.retries))
                except Exception as exc:  # noqa: BLE001
                    log.warning("Daily events not available for %s: %s", ymd, exc)

        if entries:
            write_manifest(out_dir, entries)
            print(json.dumps(entries, indent=2))
        return 0
    finally:
        try:
            sftp.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            transport.close()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    raise SystemExit(main())
