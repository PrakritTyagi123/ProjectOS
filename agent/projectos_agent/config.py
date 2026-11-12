"""Agent settings. Read from agent.yaml next to the registry, overridable by env vars."""
from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field


class Settings(BaseModel):
    machine_id: str = "desktop-01"
    host: str = "127.0.0.1"  # never 0.0.0.0: cloudflared connects locally
    port: int = 8765
    registry_path: Path = Path("registry.yaml")
    log_dir: Path = Path("logs")
    audit_path: Path = Path("logs/audit.jsonl")
    secrets_path: Path = Path("secrets.env")

    # Cloudflare Access. Both required unless dev_allow_local is true.
    access_team_domain: str = ""  # e.g. "yourteam.cloudflareaccess.com"
    access_aud: list[str] = Field(default_factory=list)  # Application Audience tag(s)

    # Lets requests from 127.0.0.1 without an Access JWT through. Development only.
    dev_allow_local: bool = False

    log_max_bytes: int = 5 * 1024 * 1024
    log_backups: int = 3
    health_interval_s: float = 5.0
    stop_timeout_s: float = 10.0
    rate_limit_per_min: int = 30


def load_settings(path: str | os.PathLike | None = None) -> Settings:
    path = Path(path or os.environ.get("PROJECTOS_CONFIG", "agent.yaml"))
    data: dict = {}
    if path.exists():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        base = path.parent
    else:
        base = Path.cwd()
    env_map = {
        "PROJECTOS_REGISTRY": "registry_path",
        "PROJECTOS_LOG_DIR": "log_dir",
        "PROJECTOS_PORT": "port",
        "PROJECTOS_MACHINE": "machine_id",
        "CF_ACCESS_TEAM_DOMAIN": "access_team_domain",
        "PROJECTOS_DEV_ALLOW_LOCAL": "dev_allow_local",
    }
    for env, key in env_map.items():
        if env in os.environ:
            data[key] = os.environ[env]
    if "CF_ACCESS_AUD" in os.environ:
        data["access_aud"] = [a.strip() for a in os.environ["CF_ACCESS_AUD"].split(",") if a.strip()]
    if isinstance(data.get("dev_allow_local"), str):
        data["dev_allow_local"] = data["dev_allow_local"].lower() in ("1", "true", "yes")
    s = Settings(**data)
    # Relative paths are relative to the config file.
    for key in ("registry_path", "log_dir", "audit_path", "secrets_path"):
        p = getattr(s, key)
        if not p.is_absolute():
            setattr(s, key, (base / p).resolve())
    return s
