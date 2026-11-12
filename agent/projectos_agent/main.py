"""HTTP API. Only reachable through cloudflared on 127.0.0.1, and every route checks Access."""
from __future__ import annotations

import mimetypes
import platform
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel

from . import __version__, metrics
from .audit import Audit
from .auth import AccessGuard, RateLimit
from .config import Settings, load_settings
from .registry import Registry
from .supervisor import StartError, Supervisor

ACTION_LABEL = {"start": "Start", "stop": "Stop", "restart": "Restart", "run": "Run job", "crash": "Crash", "agent": "Agent"}


class StartBody(BaseModel):
    profile: str | None = None


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or load_settings()
    registry = Registry(s.registry_path, s.secrets_path)
    audit = Audit(s.audit_path, s.machine_id)
    sup = Supervisor(registry, s.log_dir, s, audit)
    guard = AccessGuard(s)
    limiter = RateLimit(s.rate_limit_per_min)
    boot = time.time()

    @asynccontextmanager
    async def lifespan(app):
        audit(action="agent", project=None, who="windows logon", result=f"agent {__version__} online")
        yield
        await sup.shutdown()

    app = FastAPI(title="ProjectOS agent", version=__version__, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.sup = sup
    app.state.registry = registry

    def who(request: Request, claims: dict) -> str:
        # The Pages Function forwards the signed-in user's email and device hint.
        email = request.headers.get("x-projectos-user") or claims.get("email") or claims.get("common_name") or claims.get("sub", "unknown")
        device = request.headers.get("x-projectos-device")
        return f"{email}" + (f" ({device})" if device else "")

    def project_or_404(pid: str):
        try:
            return registry.get(pid)
        except KeyError:
            raise HTTPException(404, f"No project with id {pid!r} in registry.yaml")

    @app.get("/api/agent")
    def agent_info(claims=Depends(guard)):
        h = metrics.host()
        return {
            "mode": "live",
            "machine": s.machine_id,
            "version": __version__,
            "os": f"{platform.system()} {platform.release()}",
            "uptimeS": int(time.time() - boot),
            "startedAt": int(boot * 1000),
            "registry": str(s.registry_path),
            "warnings": registry.warnings,
            "gpu": (h["gpu"] or {}).get("name"),
            "vramTotalGb": (h["gpu"] or {}).get("vramTotalGb"),
            "ramTotalGb": h["ramTotalGb"],
            "cpu": h["cpuName"],
        }

    @app.get("/api/projects")
    def list_projects(claims=Depends(guard)):
        g = metrics._gpu()
        out = []
        for p in registry.all():
            rt = sup.runtime(p.id)
            item = p.public()
            item["runtime"] = {**rt.public(), **(metrics.project(rt.handle, g) if rt.status in ("running", "unhealthy", "starting") else {"cpu": 0, "ram": 0, "vram": 0, "procs": 0})}
            out.append(item)
        return {"projects": out, "warnings": registry.warnings, "t": int(time.time() * 1000)}

    @app.get("/api/projects/{pid}")
    def get_project(pid: str, claims=Depends(guard)):
        p = project_or_404(pid)
        return {**p.public(), "runtime": sup.runtime(pid).public()}

    @app.post("/api/projects/{pid}/start")
    async def start(pid: str, request: Request, body: StartBody | None = None, claims=Depends(guard)):
        p = project_or_404(pid)
        actor = who(request, claims)
        limiter.check(actor)
        if p.id == "projectos":
            raise HTTPException(400, "The agent can't start itself.")
        prof = body.profile if body and body.profile and body.profile != "Default" else None
        if prof and prof not in p.profiles:
            raise HTTPException(400, f"Unknown profile {prof!r}")
        try:
            rt = await sup.start(pid, prof, who=actor)
        except StartError as e:
            audit(action="start", project=pid, who=actor, result=f"refused: {e}")
            raise HTTPException(409, str(e))
        return rt.public()

    @app.post("/api/projects/{pid}/stop")
    async def stop(pid: str, request: Request, claims=Depends(guard)):
        project_or_404(pid)
        actor = who(request, claims)
        limiter.check(actor)
        return (await sup.stop(pid, who=actor)).public()

    @app.post("/api/projects/{pid}/restart")
    async def restart(pid: str, request: Request, claims=Depends(guard)):
        project_or_404(pid)
        actor = who(request, claims)
        limiter.check(actor)
        try:
            return (await sup.restart(pid, who=actor)).public()
        except StartError as e:
            raise HTTPException(409, str(e))

    @app.get("/api/projects/{pid}/logs")
    def logs(pid: str, tail: int = 400, since: int | None = None, claims=Depends(guard)):
        p = project_or_404(pid)
        return {"lines": sup.log(p).tail(min(max(tail, 1), 2000), since)}

    @app.get("/api/projects/{pid}/readme")
    def readme(pid: str, claims=Depends(guard)):
        p = project_or_404(pid)
        f = Path(p.working_directory) / p.readme
        if not f.is_file():
            raise HTTPException(404, "No README in the project folder")
        return PlainTextResponse(f.read_text(encoding="utf-8", errors="replace"))

    @app.get("/api/projects/{pid}/media/{path:path}")
    def media(pid: str, path: str, claims=Depends(guard)):
        """Files under the project's docs folder only. No traversal, media types only."""
        p = project_or_404(pid)
        root = (Path(p.working_directory) / p.docs_dir).resolve()
        f = (root / path).resolve()
        if root not in f.parents or not f.is_file():
            raise HTTPException(404, "Not found")
        mt = mimetypes.guess_type(f.name)[0] or ""
        if not (mt.startswith("image/") or mt.startswith("video/")):
            raise HTTPException(415, "Only images and videos are served")
        return FileResponse(f, media_type=mt)  # Starlette handles Range for video seeking

    @app.get("/api/host/metrics")
    def host_metrics(claims=Depends(guard)):
        h = metrics.host()
        if h["gpu"]:
            h["gpu"] = {k: v for k, v in h["gpu"].items() if k != "perPid"}
        return h

    @app.get("/api/activity")
    def activity(n: int = 200, claims=Depends(guard)):
        out = []
        for r in audit.tail(min(n, 1000)):
            out.append({"t": r["t"], "action": ACTION_LABEL.get(r["action"], r["action"].title()), "project": r.get("project"), "who": r.get("who"), "result": r.get("result"), "machine": r.get("machine"), "bad": str(r.get("result", "")).startswith(("failed", "refused", "exit 1"))})
        return {"items": out}

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        return JSONResponse({"detail": f"Agent error: {type(exc).__name__}"}, status_code=500)

    return app
