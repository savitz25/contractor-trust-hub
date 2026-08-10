"""Load sensitive env vars from .env / .env.local (never commit secrets)."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv_files(*paths: Path | None) -> list[str]:
    """
    Minimal dotenv loader (no python-dotenv dependency).
    Existing process env wins over file values.
    Returns list of files that contributed at least one new key.
    """
    candidates = [p for p in paths if p is not None]
    if not candidates:
        candidates = [
            ROOT / ".env.local",
            ROOT / ".env",
        ]

    loaded: list[str] = []
    for path in candidates:
        if not path.is_file():
            continue
        contributed = False
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower().startswith("export "):
                line = line[7:].strip()
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if not key:
                continue
            if key not in os.environ or os.environ.get(key) == "":
                os.environ[key] = value
                contributed = True
        if contributed:
            loaded.append(str(path))
    return loaded


def normalize_database_url(url: str, *, connect_timeout: str = "15") -> str:
    """
    Ensure Supabase-friendly query params on a Postgres URI.
    Prefer direct or session-pooler URLs for bulk loads (not transaction :6543 alone).
    """
    url = url.strip().strip('"').strip("'")
    if not url:
        return url

    # libpq keyword form — leave as-is aside from connect_timeout if missing
    if not url.startswith("postgres"):
        if "connect_timeout=" not in url:
            return f"{url} connect_timeout={connect_timeout}".strip()
        return url

    lower = url.lower()
    extras: list[str] = []
    if "sslmode=" not in lower:
        extras.append("sslmode=require")
    if "connect_timeout=" not in lower and "connect_timeout%3d" not in lower:
        extras.append(f"connect_timeout={connect_timeout}")

    if not extras:
        return url
    sep = "&" if "?" in url else "?"
    return url + sep + "&".join(extras)
