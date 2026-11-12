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
| `src/extra.js` | Demo tasks, git, deployments, games, AI jobs, modules and launch profiles. |
| `src/App.jsx` | Shell: collapsible sidebar, toolbar with project jump (`/`), routing, shared Start/Stop/Open/More actions. |
| `src/Projects.jsx` | Project library: dense list with expandable rows, or grid. |
| `src/Runtime.jsx`, `Machines.jsx`, `Deploy.jsx`, `Repos.jsx`, `Tasks.jsx`, `Games.jsx`, `AIStudio.jsx`, `Settings.jsx` | One page each. |
| `src/store.jsx` | Simulated agent: start/stop/restart, health, logs, VRAM checks. |
| `src/Overview.jsx` | Active-project band, machine panel, project list. |
| `src/ProjectPage.jsx` | Per-project page: Overview, Logs, Config, Plan, Models. |
| `src/PlanPage.jsx` | Active / Committed / Queued / Parked board, week, idea inbox. |
| `src/ActivityPage.jsx` | Audit log of remote actions. |
| `src/Readme.jsx` | Per-project README page (`#readme-<id>`): Markdown editor, images, GIFs, videos. |
| `src/readmes.js` | Demo README text and images. |
| `src/media.js` | IndexedDB storage for uploaded media (demo only). |
| `src/AddProject.jsx` | Register-a-project flow with validation. |

## Going from demo to real (later, not now)

Everything the UI needs comes through `useEngine` in `store.jsx`. Replace:

- `start(id)` → `POST /api/projects/{id}/start`
- `stop(id)` → `POST /api/projects/{id}/stop`
- `TICK` → poll `GET /api/projects` and `GET /api/host/metrics` every 2 s
- logs → `GET /api/projects/{id}/logs?tail=400` (or SSE)

The browser only ever sends a project **id**. Paths and commands stay in
`registry.yaml` on the PC.

Theme: light, dark or match system, from the switch in the top bar.

README pages: every project has one at `#readme-<id>` (or the README tab).
Edit with Markdown; drop, paste or pick images, GIFs and videos (up to 300 MB
each). In the demo they're stored in this browser (IndexedDB). For the real
app, have the agent serve `README.md` and `docs/media/*` from each project folder:

- `GET /api/projects/{id}/readme` → markdown
- `GET /api/projects/{id}/media/{file}` → the file (supports Range for video)

Plan, tasks, modules and profiles are saved in this browser's localStorage only.
Settings → Reset demo clears them.
