"""Per-project logs: an in-memory ring for the API plus rotating files on disk. Secrets are redacted."""
from __future__ import annotations

import re
import threading
import time
from collections import deque
from logging.handlers import RotatingFileHandler
import logging
from pathlib import Path

GENERIC = [
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{12,}"),
    re.compile(r"(?i)((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+"),
    re.compile(r"(?i)(postgres(?:ql)?://[^:\s]+:)[^@\s]+(@)"),
]


class ProjectLog:
    def __init__(self, project_id: str, log_dir: Path, max_bytes: int, backups: int, secrets: list[str] | None = None):
        self.id = project_id
        self.ring: deque[dict] = deque(maxlen=2000)
        self.lock = threading.Lock()
        self.secrets = [s for s in (secrets or []) if s and len(s) >= 4]
        log_dir.mkdir(parents=True, exist_ok=True)
        self.file = logging.getLogger(f"projectos.project.{project_id}")
        self.file.propagate = False
        self.file.setLevel(logging.INFO)
        if not self.file.handlers:
            h = RotatingFileHandler(log_dir / f"{project_id}.log", maxBytes=max_bytes, backupCount=backups, encoding="utf-8")
            h.setFormatter(logging.Formatter("%(message)s"))
            self.file.addHandler(h)

    def set_secrets(self, values: list[str]) -> None:
        self.secrets = [s for s in values if s and len(s) >= 4]

    def redact(self, text: str) -> str:
        for s in self.secrets:
            text = text.replace(s, "••••••")
        for rx in GENERIC:
            text = rx.sub(lambda m: m.group(1) + "••••••" + (m.group(2) if m.lastindex and m.lastindex >= 2 else ""), text)
        return text

    def add(self, stream: str, text: str) -> None:
        text = self.redact(text.rstrip("\r\n"))
        entry = {"t": int(time.time() * 1000), "stream": stream, "text": text}
        with self.lock:
            self.ring.append(entry)
        self.file.info("%s %-6s %s", time.strftime("%Y-%m-%d %H:%M:%S"), stream, text)

    def tail(self, n: int = 400, since: int | None = None) -> list[dict]:
        with self.lock:
            items = list(self.ring)
        if since:
            items = [e for e in items if e["t"] > since]
        return items[-n:]


def pump(stream, log: ProjectLog, name: str) -> threading.Thread:
    """Read a child's stdout/stderr line by line on a background thread."""

    def run():
        try:
            for raw in iter(stream.readline, b""):
                log.add(name, raw.decode("utf-8", errors="replace"))
        except Exception:
            pass
        finally:
            try:
                stream.close()
            except Exception:
                pass

    t = threading.Thread(target=run, daemon=True, name=f"pump-{log.id}-{name}")
    t.start()
    return t
