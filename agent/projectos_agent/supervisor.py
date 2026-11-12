"""Lifecycle: stopped -> starting (spawn, boot, health) -> running -> stopping -> stopped.

A process that exists is not a running project. It only becomes running when its health
check answers, or (with no health URL) when it has stayed alive through a short grace period.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from . import procs
from .logs import ProjectLog, pump
from .registry import SECRET_KEY, Project, Registry

GRACE_NO_HEALTH_S = 3.0


@dataclass
class Runtime:
    status: str = "stopped"  # stopped | starting | running | unhealthy | stopping | failed
    phase: str | None = None  # spawn | boot | health | ready
    pid: int | None = None
    started_at: float | None = None
    ready_ms: int | None = None
    last_exit: int | None = None
    last_run_at: float | None = None
    failed_at: float | None = None
    error: str | None = None
    profile: str = "Default"
    health: dict | None = None
    restarts: int = 0
    handle: procs.Handle | None = field(default=None, repr=False)
    task: asyncio.Task | None = field(default=None, repr=False)

    def public(self) -> dict:
        ms = lambda t: int(t * 1000) if t else None
        return {
            "status": self.status,
            "phase": self.phase,
            "pid": self.pid,
            "startedAt": ms(self.started_at),
            "readyMs": self.ready_ms,
            "lastExit": self.last_exit,
            "lastRunAt": ms(self.last_run_at),
            "failedAt": ms(self.failed_at),
            "error": self.error,
            "profile": self.profile,
            "health": self.health,
            "restarts": self.restarts,
        }


class StartError(Exception):
    pass


class Supervisor:
    def __init__(self, registry: Registry, log_dir: Path, settings, audit=None):
        self.registry = registry
        self.settings = settings
        self.log_dir = Path(log_dir)
        self.rt: dict[str, Runtime] = {}
        self.logs: dict[str, ProjectLog] = {}
        self.audit = audit or (lambda **kw: None)
        self.http = httpx.AsyncClient(timeout=2.0)
        self._lock = asyncio.Lock()

    # ── helpers ─────────────────────────────────────────────
    def runtime(self, pid: str) -> Runtime:
        return self.rt.setdefault(pid, Runtime())

    def log(self, p: Project) -> ProjectLog:
        if p.id not in self.logs:
            self.logs[p.id] = ProjectLog(p.id, self.log_dir, self.settings.log_max_bytes, self.settings.log_backups)
        lg = self.logs[p.id]
        lg.set_secrets([v for launch in [p.launch, *p.profiles.values()] for k, v in launch.env.items() if SECRET_KEY.search(k)])
        return lg

    async def _healthy(self, p: Project) -> tuple[bool, int | None, int | None]:
        if not p.network.health_url:
            return True, None, None
        t0 = time.perf_counter()
        try:
            r = await self.http.get(p.network.health_url)
            ms = int((time.perf_counter() - t0) * 1000)
            return 200 <= r.status_code < 400, ms, r.status_code
        except httpx.HTTPError:
            return False, None, None

    # ── start ───────────────────────────────────────────────
    async def start(self, pid: str, profile: str | None = None, who: str = "unknown", _chain: tuple = ()) -> Runtime:
        p = self.registry.get(pid)
        if pid in _chain:
            raise StartError(f"dependency cycle: {' -> '.join((*_chain, pid))}")
        rt = self.runtime(pid)
        if rt.status in ("starting", "running", "stopping"):
            return rt
        # Dependencies first, each must reach running.
        for dep in p.depends_on:
            d = self.runtime(dep)
            if d.status != "running":
                await self.start(dep, who=who, _chain=(*_chain, pid))
                for _ in range(int(self.registry.get(dep).startup_timeout_s * 4)):
                    if self.runtime(dep).status in ("running", "failed", "stopped"):
                        break
                    await asyncio.sleep(0.25)
                if self.runtime(dep).status != "running":
                    raise StartError(f"dependency {dep} did not become ready")
        if p.network.local_port and not p.network.udp:
            owner = procs.port_owner(p.network.local_port)
            if owner:
                raise StartError(f"port {p.network.local_port} is already in use by PID {owner[0]} ({owner[1]})")
        if not Path(p.working_directory).is_dir():
            raise StartError(f"working directory not found: {p.working_directory}")

        launch = p.launch_for(profile)
        lg = self.log(p)
        lg.add("agent", f"── start requested by {who} (profile: {profile or 'Default'}) ──")
        lg.add("agent", f"spawn {Path(launch.executable).name} {' '.join(launch.args)}")
        rt.status, rt.phase, rt.error, rt.health = "starting", "spawn", None, None
        rt.profile = profile or "Default"
        rt.started_at = time.time()
        try:
            h = procs.spawn(launch.executable, launch.args, p.working_directory, launch.env, p.interactive)
        except OSError as e:
            rt.status, rt.failed_at, rt.error = "failed", time.time(), f"Could not launch: {e}"
            lg.add("agent", rt.error)
            self.audit(action="start", project=pid, who=who, result="failed: " + str(e))
            return rt
        rt.handle, rt.pid = h, h.pid
        lg.add("agent", f"pid {h.pid}" + (", job object attached" if h.job else ", process group created"))
        pump(h.popen.stdout, lg, "out")
        pump(h.popen.stderr, lg, "err")
        rt.phase = "boot"
        rt.task = asyncio.create_task(self._watch(p, rt, who))
        return rt

    async def _watch(self, p: Project, rt: Runtime, who: str) -> None:
        lg = self.log(p)
        h = rt.handle
        t0 = rt.started_at or time.time()
        deadline = t0 + p.startup_timeout_s
        # ── until ready ──
        while rt.status == "starting":
            code = h.poll()
            if code is not None:
                rt.last_exit, rt.last_run_at = code, time.time()
                if p.type == "job" and code == 0:
                    rt.status, rt.phase, rt.pid = "stopped", None, None
                    lg.add("agent", "job finished, exit 0")
                    self.audit(action="run", project=p.id, who=who, result="exit 0")
                else:
                    rt.status, rt.failed_at = "failed", time.time()
                    rt.error = f"Process exited with code {code} before it was ready."
                    lg.add("agent", f"process exited with code {code}; marked failed (never passed health check)")
                    self.audit(action="start", project=p.id, who=who, result=f"failed: exit {code}")
                return
            if p.type == "job":
                rt.status, rt.phase = "running", "ready"
                rt.ready_ms = int((time.time() - t0) * 1000)
                self.audit(action="run", project=p.id, who=who, result="started")
                break
            if p.network.health_url:
                if time.time() - t0 > 0.6:
                    rt.phase = "health"
                ok, ms, code = await self._healthy(p)
                if ok:
                    rt.health = {"ok": True, "ms": ms, "at": int(time.time() * 1000), "code": code}
                    break
            elif time.time() - t0 >= GRACE_NO_HEALTH_S:
                break
            if time.time() > deadline:
                lg.add("agent", f"not ready after {p.startup_timeout_s:.0f} s; stopping")
                rt.error = f"Not ready after {p.startup_timeout_s:.0f} s."
                await self._terminate(rt, lg)
                rt.status, rt.failed_at = "failed", time.time()
                self.audit(action="start", project=p.id, who=who, result="failed: timeout")
                return
            await asyncio.sleep(0.5)
        if rt.status == "starting":
            rt.status, rt.phase = "running", "ready"
            rt.ready_ms = int((time.time() - t0) * 1000)
            lg.add("agent", f"ready after {rt.ready_ms / 1000:.1f} s")
            self.audit(action="start", project=p.id, who=who, result=f"ready in {rt.ready_ms / 1000:.1f} s")
        # ── while running ──
        last_check = 0.0
        while rt.status in ("running", "unhealthy"):
            code = h.poll()
            if code is not None:
                rt.last_exit, rt.last_run_at, rt.pid = code, time.time(), None
                if p.type == "job":
                    rt.status, rt.phase = ("stopped" if code == 0 else "failed"), None
                    if code:
                        rt.failed_at, rt.error = time.time(), f"Job exited with code {code}."
                    lg.add("agent", f"job finished, exit {code}")
                    self.audit(action="run", project=p.id, who="agent", result=f"exit {code}")
                    return
                rt.status, rt.failed_at, rt.error = "failed", time.time(), f"Process exited with code {code} while running."
                lg.add("agent", rt.error)
                self.audit(action="crash", project=p.id, who="agent", result=f"exit {code}")
                if p.restart_policy in ("on-crash", "always") and rt.restarts < 5:
                    rt.restarts += 1
                    delay = min(30, 2 ** rt.restarts)
                    lg.add("agent", f"restart policy {p.restart_policy}: restarting in {delay} s (attempt {rt.restarts})")
                    await asyncio.sleep(delay)
                    if rt.status == "failed":
                        await self.start(p.id, rt.profile if rt.profile != "Default" else None, who="restart policy")
                return
            if p.network.health_url and time.time() - last_check >= self.settings.health_interval_s:
                last_check = time.time()
                ok, ms, code = await self._healthy(p)
                rt.health = {"ok": ok, "ms": ms, "at": int(time.time() * 1000), "code": code}
                if not ok and rt.status == "running":
                    rt.status = "unhealthy"
                    lg.add("agent", "health check failing")
                elif ok and rt.status == "unhealthy":
                    rt.status = "running"
                    lg.add("agent", "health check recovered")
            await asyncio.sleep(0.5)

    # ── stop ────────────────────────────────────────────────
    async def _terminate(self, rt: Runtime, lg: ProjectLog) -> None:
        h = rt.handle
        if not h:
            return
        procs.ask_to_stop(h)
        lg.add("agent", f"asked to stop, waiting up to {self.settings.stop_timeout_s:.0f} s")
        t0 = time.time()
        while h.poll() is None and time.time() - t0 < self.settings.stop_timeout_s:
            await asyncio.sleep(0.2)
        graceful = h.poll() is not None
        await asyncio.to_thread(procs.kill_tree, h)  # also clears children that outlived the parent
        lg.add("agent", f"{'exited' if graceful else 'did not exit; killed process tree'} after {time.time() - t0:.1f} s")

    async def stop(self, pid: str, who: str = "unknown") -> Runtime:
        p = self.registry.get(pid)
        rt = self.runtime(pid)
        if rt.status not in ("starting", "running", "unhealthy"):
            return rt
        lg = self.log(p)
        lg.add("agent", f"── stop requested by {who} ──")
        rt.status = "stopping"
        if rt.task:
            rt.task.cancel()
        await self._terminate(rt, lg)
        code = rt.handle.poll() if rt.handle else None
        rt.status, rt.phase, rt.pid, rt.last_exit, rt.last_run_at = "stopped", None, None, code, time.time()
        rt.handle, rt.restarts = None, 0
        self.audit(action="stop", project=pid, who=who, result="stopped")
        return rt

    async def restart(self, pid: str, who: str = "unknown") -> Runtime:
        prof = self.runtime(pid).profile
        await self.stop(pid, who=who)
        return await self.start(pid, None if prof == "Default" else prof, who=who)

    async def shutdown(self) -> None:
        """Agent exit: stop everything it started."""
        for pid, rt in list(self.rt.items()):
            if rt.handle and rt.handle.poll() is None:
                try:
                    await self.stop(pid, who="agent shutdown")
                except Exception:
                    pass
        await self.http.aclose()
