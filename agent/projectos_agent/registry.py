"""registry.yaml: the only list of things the agent will ever run.

The browser refers to projects by id. It never sends a path, an executable or arguments.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")
SHELL_CHARS = re.compile(r"[;&|`<>]|\$\(")
SECRET_KEY = re.compile(r"(SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE|DATABASE_URL|DSN)", re.I)


class Launch(BaseModel):
    executable: str
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)

    @field_validator("args")
    @classmethod
    def no_shell(cls, v: list[str]) -> list[str]:
        for a in v:
            if SHELL_CHARS.search(a):
                raise ValueError(f"argument {a!r} contains shell syntax; args are passed as a list, never to a shell")
        return v


class Network(BaseModel):
    local_port: int | None = None
    udp: bool = False
    health_url: str | None = None
    frontend_url: str | None = None

    @field_validator("health_url")
    @classmethod
    def local_only(cls, v: str | None) -> str | None:
        if v is None:
            return v
        host = urlparse(v).hostname
        if host not in ("127.0.0.1", "localhost", "::1"):
            raise ValueError("health_url must point at this machine (127.0.0.1)")
        return v


class Resources(BaseModel):
    gpu_required: bool = False
    exclusive_gpu_profile: bool = False
    expected_vram_gb: float = 0
    expected_ram_gb: float = 0


class Project(BaseModel):
    id: str
    name: str
    category: Literal["web", "ai", "games", "tools"] = "tools"
    kind: str = "Program"
    description: str = ""
    machine: str = "desktop-01"
    working_directory: str
    launch: Launch
    profiles: dict[str, Launch] = Field(default_factory=dict)  # optional named variants
    network: Network = Field(default_factory=Network)
    resources: Resources = Field(default_factory=Resources)
    type: Literal["service", "job"] = "service"
    interactive: bool = False  # GUI app that needs the logged-in desktop (Unity Editor)
    restart_policy: Literal["manual", "on-crash", "always", "never"] = "manual"
    depends_on: list[str] = Field(default_factory=list)
    startup_timeout_s: float = 120
    repo: str | None = None
    readme: str = "README.md"
    docs_dir: str = "docs"

    @field_validator("id")
    @classmethod
    def good_id(cls, v: str) -> str:
        if not ID_RE.match(v):
            raise ValueError("id must be lowercase letters, digits and hyphens")
        return v

    @model_validator(mode="after")
    def profile_args_safe(self):
        for name, l in self.profiles.items():
            Launch.no_shell(l.args)
        return self

    def launch_for(self, profile: str | None) -> Launch:
        if profile and profile in self.profiles:
            base = self.launch.model_copy(deep=True)
            p = self.profiles[profile]
            return Launch(executable=p.executable or base.executable, args=p.args or base.args, env={**base.env, **p.env})
        return self.launch

    def profile_names(self) -> list[str]:
        return ["Default", *self.profiles.keys()] if self.profiles else ["Default"]

    def public(self) -> dict:
        """What the browser may see. Secret env values are masked."""
        env = {k: ("••••••" if SECRET_KEY.search(k) else v) for k, v in self.launch.env.items()}
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "kind": self.kind,
            "description": self.description,
            "machine": self.machine,
            "cwd": self.working_directory,
            "exe": self.launch.executable,
            "args": self.launch.args,
            "env": env,
            "port": self.network.local_port,
            "udp": self.network.udp,
            "health": self.network.health_url,
            "frontend": self.network.frontend_url,
            "gpu": self.resources.gpu_required,
            "exclusiveGpu": self.resources.exclusive_gpu_profile,
            "profile": {"vram": self.resources.expected_vram_gb, "ram": self.resources.expected_ram_gb, "cpu": 0},
            "job": self.type == "job",
            "interactive": self.interactive,
            "restart": self.restart_policy,
            "deps": self.depends_on,
            "repo": self.repo or "",
            "profiles": self.profile_names(),
        }


class RegistryError(Exception):
    pass


class Registry:
    """Loads registry.yaml and reloads it when the file changes."""

    def __init__(self, path: Path, secrets_path: Path | None = None):
        self.path = Path(path)
        self.secrets_path = secrets_path
        self._mtime = 0.0
        self.projects: dict[str, Project] = {}
        self.warnings: list[str] = []
        self.reload(force=True)

    def _secrets(self) -> dict[str, str]:
        out: dict[str, str] = {}
        if self.secrets_path and self.secrets_path.exists():
            for line in self.secrets_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    out[k.strip()] = v.strip()
        return out

    def reload(self, force: bool = False) -> bool:
        try:
            m = self.path.stat().st_mtime
        except FileNotFoundError as e:
            raise RegistryError(f"registry not found: {self.path}") from e
        if not force and m == self._mtime:
            return False
        raw = yaml.safe_load(self.path.read_text(encoding="utf-8")) or {}
        items = raw.get("projects", raw if isinstance(raw, list) else [])
        secrets = self._secrets()
        projects: dict[str, Project] = {}
        warnings: list[str] = []
        for item in items:
            try:
                p = Project(**item)
            except Exception as e:  # keep the good entries, report the bad one
                warnings.append(f"{item.get('id', '?')}: {e}")
                continue
            if p.id in projects:
                warnings.append(f"{p.id}: duplicate id ignored")
                continue
            # ${secret:NAME} pulls from secrets.env so secrets stay out of registry.yaml
            for launch in [p.launch, *p.profiles.values()]:
                for k, v in list(launch.env.items()):
                    mm = re.fullmatch(r"\$\{secret:([A-Za-z0-9_]+)\}", v)
                    if mm:
                        launch.env[k] = secrets.get(mm.group(1), "")
            if not Path(p.working_directory).is_dir():
                warnings.append(f"{p.id}: working_directory does not exist: {p.working_directory}")
            exe = p.launch.executable
            if os.sep in exe or "/" in exe:
                if not Path(exe).exists():
                    warnings.append(f"{p.id}: executable not found: {exe}")
            projects[p.id] = p
        ports = {}
        for p in projects.values():
            port = p.network.local_port
            if port:
                if port in ports:
                    warnings.append(f"{p.id}: port {port} also used by {ports[port]}")
                ports[port] = p.id
        for p in projects.values():
            for d in p.depends_on:
                if d not in projects:
                    warnings.append(f"{p.id}: depends_on unknown project {d}")
        self.projects = projects
        self.warnings = warnings
        self._mtime = m
        return True

    def get(self, pid: str) -> Project:
        self.reload()
        if pid not in self.projects:
            raise KeyError(pid)
        return self.projects[pid]

    def all(self) -> list[Project]:
        self.reload()
        return list(self.projects.values())
