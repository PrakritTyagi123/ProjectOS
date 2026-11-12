"""Spawning and stopping whole process trees.

Windows: each project runs in its own Job Object with KILL_ON_JOB_CLOSE, so closing the job
kills every child (uvicorn workers, model servers, shells a script opened). Console apps get a
new process group so CTRL_BREAK can ask them to stop first. GUI apps get WM_CLOSE via taskkill.

POSIX (for development and tests): a new session; SIGTERM to the group, then SIGKILL.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field

import psutil

WINDOWS = sys.platform == "win32"

if WINDOWS:  # pragma: no cover - exercised on the real machine
    import win32api
    import win32con
    import win32job


@dataclass
class Handle:
    popen: subprocess.Popen
    interactive: bool = False
    job: object | None = None
    started: float = field(default_factory=time.time)

    @property
    def pid(self) -> int:
        return self.popen.pid

    def poll(self) -> int | None:
        return self.popen.poll()

    def tree(self) -> list[psutil.Process]:
        try:
            root = psutil.Process(self.pid)
            return [root, *root.children(recursive=True)]
        except psutil.Error:
            return []


def _new_job():  # pragma: no cover
    job = win32job.CreateJobObject(None, "")
    info = win32job.QueryInformationJobObject(job, win32job.JobObjectExtendedLimitInformation)
    info["BasicLimitInformation"]["LimitFlags"] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    win32job.SetInformationJobObject(job, win32job.JobObjectExtendedLimitInformation, info)
    return job


def spawn(executable: str, args: list[str], cwd: str, env: dict[str, str], interactive: bool = False) -> Handle:
    full_env = {**os.environ, **env}
    full_env.setdefault("PYTHONUNBUFFERED", "1")  # live logs from Python projects
    kwargs: dict = dict(
        cwd=cwd,
        env=full_env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=False,  # never a shell
    )
    if WINDOWS:  # pragma: no cover
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if not interactive:
            flags |= subprocess.CREATE_NO_WINDOW
        kwargs["creationflags"] = flags
    else:
        kwargs["start_new_session"] = True
    popen = subprocess.Popen([executable, *args], **kwargs)
    h = Handle(popen=popen, interactive=interactive)
    if WINDOWS:  # pragma: no cover
        h.job = _new_job()
        hproc = win32api.OpenProcess(win32con.PROCESS_SET_QUOTA | win32con.PROCESS_TERMINATE, False, popen.pid)
        try:
            win32job.AssignProcessToJobObject(h.job, hproc)
        finally:
            win32api.CloseHandle(hproc)
    return h


def ask_to_stop(h: Handle) -> None:
    """Polite stop. The caller waits, then calls kill_tree."""
    if h.poll() is not None:
        return
    if WINDOWS:  # pragma: no cover
        if h.interactive:
            # WM_CLOSE to every window in the tree; Unity asks to save if needed.
            subprocess.run(["taskkill", "/PID", str(h.pid), "/T"], capture_output=True)
        else:
            try:
                os.kill(h.pid, signal.CTRL_BREAK_EVENT)
            except OSError:
                pass
    else:
        try:
            os.killpg(os.getpgid(h.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass


def kill_tree(h: Handle) -> None:
    if WINDOWS and h.job is not None:  # pragma: no cover
        try:
            win32job.TerminateJobObject(h.job, 1)
        except Exception:
            pass
    else:
        try:
            os.killpg(os.getpgid(h.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    # Belt and braces: anything that escaped the job or group.
    for p in h.tree():
        try:
            p.kill()
        except psutil.Error:
            pass
    try:
        h.popen.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def port_owner(port: int) -> tuple[int, str] | None:
    """Who is listening on this TCP port, if anyone."""
    try:
        for c in psutil.net_connections(kind="inet"):
            if c.laddr and c.laddr.port == port and c.status == psutil.CONN_LISTEN:
                try:
                    return c.pid or 0, psutil.Process(c.pid).name() if c.pid else "unknown"
                except psutil.Error:
                    return c.pid or 0, "unknown"
    except (psutil.AccessDenied, PermissionError):
        import socket

        s = socket.socket()
        try:
            s.bind(("127.0.0.1", port))
        except OSError:
            return 0, "unknown"
        finally:
            s.close()
    return None
