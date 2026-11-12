# NEXT STEP

**Active project:** ProjectOS v0.1. Nothing else becomes active until v0.1 is tagged.

## Where it stands (2026-11-12)

- Dashboard UI: done (demo + live mode). Stop adding pages.
- Agent: written and tested on Linux (9 tests: health-gated ready, tree kill, failed start,
  jobs, port conflicts, dependencies, path traversal, Access JWT). **Not yet run on Windows.**
- Pages Function `/api` proxy: written, not deployed.

## Next action (one sitting)

1. On desktop-01: `agent\scripts\install.ps1`, fill in `registry.yaml` for **ComfyUI** and
   **AI Companion** with the real paths, ports and health URLs.
2. `dev_allow_local: true`, run the agent, `npm run dev`, start and stop both from the dashboard.
3. Watch Task Manager while stopping AI Companion: no python.exe left behind.

## After that

DEPLOY.md steps 2 to 5. Then tick the checklist at the bottom of DEPLOY.md and tag `v0.1`.

## Parked until after v0.1 (do not start)

Tasks/Git/Deploy/Games/AI Studio pages read real data, Wake-on-LAN, multi-PC, Unity builds,
ComfyUI queueing, README editing that writes back to the PC.

## Handoff note template

```
Date:
Did:
Broke / blocked by:
Next experiment:
Next action:
```
