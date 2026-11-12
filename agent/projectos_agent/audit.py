"""Append-only JSON-lines audit log of every remote action."""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path


class Audit:
    def __init__(self, path: Path, machine: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.machine = machine
        self.lock = threading.Lock()

    def __call__(self, *, action: str, project: str | None, who: str, result: str, **extra) -> None:
        rec = {"t": int(time.time() * 1000), "action": action, "project": project, "who": who, "result": result, "machine": self.machine, **extra}
        line = json.dumps(rec, ensure_ascii=False)
        with self.lock, self.path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    def tail(self, n: int = 200) -> list[dict]:
        if not self.path.exists():
            return []
        with self.lock:
            lines = self.path.read_text(encoding="utf-8").splitlines()[-n:]
        out = []
        for l in reversed(lines):
            try:
                out.append(json.loads(l))
            except json.JSONDecodeError:
                pass
        return out
