# ProjectOS agent

Runs on the Windows PC. Starts and stops the projects listed in `registry.yaml`, decides when
they're ready (health check, not PID), keeps logs, reports CPU/RAM/GPU/VRAM, and answers the
dashboard through Cloudflare Tunnel. Every request must carry a valid Cloudflare Access token.

## What it will and won't do

- Runs only entries from `registry.yaml`, by id. The browser can't send paths, commands or args.
- Args are a list passed straight to the program. No shell. `;`, `|`, `&`, `>`, `` ` `` are rejected.
- Listens on 127.0.0.1 only and refuses to start on a public interface.
- Each project runs in a Windows Job Object; stopping closes the job, so child processes go too.
- Secrets live in `secrets.env` (`${secret:NAME}` in the registry) and are redacted from logs and the API.
- Every start, stop, crash and refusal is appended to `logs/audit.jsonl`.

## Setup (Windows)

```powershell
cd agent
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
notepad registry.yaml          # real paths, ports, health URLs
```

Test locally before involving Cloudflare. In `agent.yaml` set `dev_allow_local: true`, then:

```powershell
.\.venv\Scripts\python.exe -m projectos_agent --config agent.yaml
curl http://127.0.0.1:8765/api/projects
curl -X POST http://127.0.0.1:8765/api/projects/comfyui/start
curl "http://127.0.0.1:8765/api/projects/comfyui/logs?tail=50"
curl -X POST http://127.0.0.1:8765/api/projects/comfyui/stop
```

Then set `dev_allow_local: false`, fill in the Access settings, and register the logon task:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1
```

## API

| Method | Path | |
|---|---|---|
| GET | `/api/agent` | machine, version, GPU, registry warnings |
| GET | `/api/projects` | registry entries + runtime state + per-project CPU/RAM/VRAM |
| GET | `/api/projects/{id}` | one project |
| POST | `/api/projects/{id}/start` | body `{"profile": "Production"}` optional |
| POST | `/api/projects/{id}/stop` | graceful, then the Job Object is closed |
| POST | `/api/projects/{id}/restart` | |
| GET | `/api/projects/{id}/logs?tail=400&since=<ms>` | redacted |
| GET | `/api/projects/{id}/readme` | README.md from the project folder |
| GET | `/api/projects/{id}/media/{path}` | images/videos under `docs/` only |
| GET | `/api/host/metrics` | CPU, RAM, GPU load, VRAM |
| GET | `/api/activity` | audit log, newest first |

## Tests

```bash
pip install -r requirements.txt pytest pytest-asyncio
pytest -q
```

They start real processes: a slow-booting HTTP service with a child process (checks that ready
waits for health, that stop leaves no orphans, that secrets are redacted), a crashing start, a
job, a port conflict, a dependency chain, path traversal on media, and Access JWT checks.
The Job Object path runs only on Windows; on Linux the tests use process groups.
