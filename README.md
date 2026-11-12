# ProjectOS dashboard (UI only, demo data)

React 18 + Vite. Everything runs in the browser against a simulated agent, so you can
host it now and wire the real agent later without redesigning anything.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

## Deploy to Cloudflare Pages

**Option A, Git (recommended)**

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build settings:
   - Framework preset: `Vite` (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. You get `https://<name>.pages.dev`.

**Option B, drag and drop (no Git)**

1. `npm install && npm run build`
2. Workers & Pages → Create → Pages → Upload assets → drop the `dist` folder.

Routing is hash-based (`#overview`, `#plan`, `#project-comfyui`), so no `_redirects`
file is needed. `public/_headers` adds basic security headers.

**Make it private:** Zero Trust → Access → Applications → Add → Self-hosted, set the
hostname to your Pages domain (or `control.yourdomain`), policy *Allow → Emails →
your email*. Do this before the real agent is connected.

## Files

| File | What it is |
|---|---|
| `src/data.js` | All demo projects, machines, plan, inbox, weekly hours. **Edit this first.** |
| `src/store.jsx` | Simulated agent: start/stop/restart, health, logs, VRAM checks. |
| `src/Overview.jsx` | Active-project band, machine panel, project list. |
| `src/ProjectPage.jsx` | Per-project page: Overview, Logs, Config, Plan, Models. |
| `src/PlanPage.jsx` | Active / Committed / Queued / Parked board, week, idea inbox. |
| `src/ActivityPage.jsx` | Audit log of remote actions. |
| `src/AddProject.jsx` | Register-a-project flow with validation. |

## Going from demo to real (later, not now)

Everything the UI needs comes through `useEngine` in `store.jsx`. Replace:

- `start(id)` → `POST /api/projects/{id}/start`
- `stop(id)` → `POST /api/projects/{id}/stop`
- `TICK` → poll `GET /api/projects` and `GET /api/host/metrics` every 2 s
- logs → `GET /api/projects/{id}/logs?tail=400` (or SSE)

The browser only ever sends a project **id**. Paths and commands stay in
`registry.yaml` on the PC.

Plan edits are saved in this browser's localStorage only. "Reset demo" in the
sidebar clears them.
