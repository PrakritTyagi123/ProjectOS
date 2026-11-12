import asyncio
import socket
import sys
import time
from pathlib import Path

import psutil
import pytest
import yaml

from projectos_agent.config import Settings
from projectos_agent.registry import Registry
from projectos_agent.supervisor import StartError, Supervisor

FIX = Path(__file__).parent / "fixtures"


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


@pytest.fixture
def env(tmp_path):
    port = free_port()
    reg = {
        "projects": [
            {"id": "svc", "name": "Service", "working_directory": str(tmp_path), "launch": {"executable": sys.executable, "args": [str(FIX / "fake_service.py"), str(port), "1.0"], "env": {"API_TOKEN": "supersecretvalue123"}}, "network": {"local_port": port, "health_url": f"http://127.0.0.1:{port}/health"}, "startup_timeout_s": 20},
            {"id": "bad", "name": "Fails", "working_directory": str(tmp_path), "launch": {"executable": sys.executable, "args": [str(FIX / "fake_fail.py")]}},
            {"id": "job", "name": "Job", "type": "job", "working_directory": str(tmp_path), "launch": {"executable": sys.executable, "args": [str(FIX / "fake_job.py")]}},
            {"id": "dep", "name": "Needs svc", "working_directory": str(tmp_path), "depends_on": ["svc"], "launch": {"executable": sys.executable, "args": [str(FIX / "fake_sleep.py")]}},
            {"id": "evil", "name": "Bad args", "working_directory": str(tmp_path), "launch": {"executable": sys.executable, "args": ["x; rm -rf /"]}},
        ]
    }
    rp = tmp_path / "registry.yaml"
    rp.write_text(yaml.safe_dump(reg))
    s = Settings(registry_path=rp, log_dir=tmp_path / "logs", audit_path=tmp_path / "logs/audit.jsonl", stop_timeout_s=3, health_interval_s=0.5)
    r = Registry(rp)
    return s, r, port


async def wait_for(sup, pid, statuses, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if sup.runtime(pid).status in statuses:
            return sup.runtime(pid).status
        await asyncio.sleep(0.1)
    return sup.runtime(pid).status


def test_registry_rejects_shell_args(env):
    s, r, _ = env
    assert "evil" not in r.projects
    assert any("shell syntax" in w for w in r.warnings)


@pytest.mark.asyncio
async def test_start_health_stop_kills_tree(env):
    s, r, port = env
    sup = Supervisor(r, s.log_dir, s)
    rt = await sup.start("svc", who="test")
    assert rt.status == "starting"  # a process is not ready yet
    assert await wait_for(sup, "svc", {"running", "failed"}) == "running"
    assert rt.ready_ms and rt.ready_ms >= 900  # waited for the health check, not the PID
    tree = [p.pid for p in rt.handle.tree()]
    assert len(tree) >= 2  # parent + child
    text = "\n".join(l["text"] for l in sup.log(r.get("svc")).tail())
    assert "supersecretvalue123" not in text and "••••••" in text  # redacted
    await sup.stop("svc", who="test")
    assert sup.runtime("svc").status == "stopped"
    await asyncio.sleep(0.3)
    assert not any(psutil.pid_exists(p) and psutil.Process(p).status() != psutil.STATUS_ZOMBIE for p in tree)  # no orphans
    await sup.shutdown()


@pytest.mark.asyncio
async def test_failed_start_is_never_running(env):
    s, r, _ = env
    sup = Supervisor(r, s.log_dir, s)
    await sup.start("bad", who="test")
    assert await wait_for(sup, "bad", {"running", "failed"}) == "failed"
    rt = sup.runtime("bad")
    assert rt.last_exit == 1 and "before it was ready" in rt.error
    errs = [l for l in sup.log(r.get("bad")).tail() if l["stream"] == "err"]
    assert errs and "FileNotFoundError" in errs[0]["text"]
    await sup.shutdown()


@pytest.mark.asyncio
async def test_job_runs_to_completion(env):
    s, r, _ = env
    sup = Supervisor(r, s.log_dir, s)
    await sup.start("job", who="test")
    assert await wait_for(sup, "job", {"stopped", "failed"}) == "stopped"
    assert sup.runtime("job").last_exit == 0
    await sup.shutdown()


@pytest.mark.asyncio
async def test_port_conflict_refused(env):
    s, r, port = env
    blocker = socket.socket()
    blocker.bind(("127.0.0.1", port))
    blocker.listen()
    sup = Supervisor(r, s.log_dir, s)
    try:
        with pytest.raises(StartError, match="already in use"):
            await sup.start("svc", who="test")
    finally:
        blocker.close()
        await sup.shutdown()


@pytest.mark.asyncio
async def test_dependencies_start_first(env):
    s, r, _ = env
    sup = Supervisor(r, s.log_dir, s)
    await sup.start("dep", who="test")
    assert sup.runtime("svc").status == "running"  # dependency was ready before dep spawned
    assert await wait_for(sup, "dep", {"running", "failed"}) == "running"
    await sup.shutdown()
    assert sup.runtime("svc").status == "stopped" and sup.runtime("dep").status == "stopped"
