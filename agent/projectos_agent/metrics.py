"""Host and per-project resource usage. GPU numbers come from NVML when available."""
from __future__ import annotations

import shutil
import subprocess
import time

import psutil

try:
    import pynvml  # from nvidia-ml-py

    pynvml.nvmlInit()
    _NVML = True
except Exception:  # no NVIDIA driver, or package missing
    _NVML = False

_cpu_primed = False


def _gpu() -> dict | None:
    if _NVML:
        try:
            h = pynvml.nvmlDeviceGetHandleByIndex(0)
            mem = pynvml.nvmlDeviceGetMemoryInfo(h)
            util = pynvml.nvmlDeviceGetUtilizationRates(h)
            name = pynvml.nvmlDeviceGetName(h)
            procs = {}
            for fn in (pynvml.nvmlDeviceGetComputeRunningProcesses, pynvml.nvmlDeviceGetGraphicsRunningProcesses):
                try:
                    for pr in fn(h):
                        if pr.usedGpuMemory:
                            procs[pr.pid] = procs.get(pr.pid, 0) + pr.usedGpuMemory
                except pynvml.NVMLError:
                    pass
            return {
                "name": name.decode() if isinstance(name, bytes) else name,
                "util": util.gpu,
                "vramUsedGb": mem.used / 2**30,
                "vramTotalGb": mem.total / 2**30,
                "perPid": {pid: b / 2**30 for pid, b in procs.items()},
            }
        except Exception:
            return None
    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=3,
            ).stdout.strip().splitlines()[0]
            name, util, used, total = [x.strip() for x in out.split(",")]
            per = {}
            apps = subprocess.run(
                ["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=3,
            ).stdout.strip().splitlines()
            for line in apps:
                try:
                    pid, mb = [x.strip() for x in line.split(",")]
                    per[int(pid)] = float(mb) / 1024
                except ValueError:
                    pass
            return {"name": name, "util": float(util), "vramUsedGb": float(used) / 1024, "vramTotalGb": float(total) / 1024, "perPid": per}
        except Exception:
            return None
    return None


def host() -> dict:
    global _cpu_primed
    cpu = psutil.cpu_percent(interval=None if _cpu_primed else 0.1)
    _cpu_primed = True
    vm = psutil.virtual_memory()
    g = _gpu()
    return {
        "t": int(time.time() * 1000),
        "cpu": cpu,
        "ramGb": (vm.total - vm.available) / 2**30,
        "ramTotalGb": vm.total / 2**30,
        "cpuName": f"{psutil.cpu_count()} threads",
        "gpu": g,
    }


def project(handle, gpu: dict | None) -> dict:
    """CPU, RAM and VRAM summed over the project's whole process tree."""
    if not handle:
        return {"cpu": 0, "ram": 0, "vram": 0, "procs": 0}
    tree = handle.tree()
    cpu = ram = 0.0
    for pr in tree:
        try:
            cpu += pr.cpu_percent(interval=None)
            ram += pr.memory_info().rss
        except Exception:
            pass
    vram = 0.0
    if gpu and gpu.get("perPid"):
        pids = {pr.pid for pr in tree}
        vram = sum(v for pid, v in gpu["perPid"].items() if pid in pids)
    return {"cpu": cpu / max(1, psutil.cpu_count()), "ram": ram / 2**30, "vram": vram, "procs": len(tree)}
