# Deploying ProjectOS (v0.1)

Order matters: get the agent working locally first, then the tunnel, then Access, then Pages.
Replace `YOURDOMAIN` with a domain whose DNS is on Cloudflare (a cheap one is fine; `pages.dev`
alone can't carry the tunnel hostnames).

```
Browser ──Access (your email)──> control.YOURDOMAIN  (Pages: dashboard + /api Function)
                                        │  service token
                                        ▼
                         agent.YOURDOMAIN ──Access (service token only)──> Tunnel ──> 127.0.0.1:8765 agent
```

## 1. Agent on the PC (about 20 min)

```powershell
cd ProjectOS\agent
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
notepad registry.yaml      # fix every TODO: paths, ports, health URLs
```

In `agent.yaml` set `dev_allow_local: true`, run it, and test from the same PC:

```powershell
.\.venv\Scripts\python.exe -m projectos_agent --config agent.yaml
curl http://127.0.0.1:8765/api/projects
curl -X POST http://127.0.0.1:8765/api/projects/comfyui/start
```

You can also run the dashboard against it locally: in the repo root, `npm run dev`
(Vite proxies `/api` to the agent) and open http://localhost:5173. The sidebar should say
**Live**. Try start, stop, a broken entry, and closing the agent window (dashboard shows offline).

## 2. Tunnel (about 10 min)

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel create projectos-home
cloudflared tunnel route dns projectos-home agent.YOURDOMAIN
```

Copy `agent/scripts/cloudflared-config.example.yml` to `%USERPROFILE%\.cloudflared\config.yml`,
fix the tunnel ID path and hostnames, then install it as a service so it runs at boot:

```powershell
cloudflared service install
```

## 3. Access (about 15 min)

Zero Trust dashboard → Access → Applications:

1. **Service token**: Access → Service Auth → Create service token `projectos-pages`. Save the
   Client ID and Secret (shown once).
2. **App "ProjectOS agent"** (self-hosted) for `agent.YOURDOMAIN`.
   Policy: action **Service Auth**, include **Service Token = projectos-pages**. Nothing else.
   Copy its **Application Audience (AUD) tag**.
3. **App "ProjectOS dashboard"** (self-hosted) for `control.YOURDOMAIN`.
   Policy: action **Allow**, include **Emails = your email**. Session 24 h.

On the PC, in `agent/agent.yaml`:

```yaml
access_team_domain: YOURTEAM.cloudflareaccess.com
access_aud: [ "<AUD tag of the ProjectOS agent app>" ]
dev_allow_local: false
```

Restart the agent, then register it to start at logon:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1
```

## 4. Dashboard on Pages (about 10 min)

Functions only deploy from Git or Wrangler, not drag-and-drop upload.

- Push this repo to GitHub (the `.gitignore` keeps `agent.yaml`, `registry.yaml`, `secrets.env` out).
- Workers & Pages → Create → Pages → Connect to Git.
  Build command `npm run build`, output `dist`, root `/`.
- Settings → Environment variables (Production):
  - `AGENT_URL` = `https://agent.YOURDOMAIN`
  - `CF_ACCESS_CLIENT_ID` = service token ID
  - `CF_ACCESS_CLIENT_SECRET` = service token secret (**Encrypt**)
- Custom domains → add `control.YOURDOMAIN` (the hostname protected in step 3.3).

Or from your PC: `npx wrangler pages deploy dist --project-name projectos` (run from the repo
root so `functions/` is included), then set the same variables in the dashboard.

## 5. Check it (v0.1 definition of done)

- [ ] `https://control.YOURDOMAIN` asks you to sign in; another email is refused.
- [ ] `https://agent.YOURDOMAIN/api/projects` in a browser is refused (no service token).
- [ ] Sidebar says **Live**; both registered projects are listed.
- [ ] Start → Starting → Running only after the health check; logs stream.
- [ ] Stop leaves no child processes (Task Manager → Details).
- [ ] A broken entry shows Failed with the traceback, never Running.
- [ ] Put the PC to sleep: dashboard still loads, shows the PC offline, Start is disabled.
- [ ] Activity shows every start/stop with your email.
- [ ] Tag the repo `v0.1`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sidebar says **Demo** on the deployed site | `/api/agent` didn't answer as JSON: Function missing (drag-and-drop deploy) or env vars unset |
| 502 "rejected the service token" | Agent Access app policy isn't Service Auth with that token |
| 403 "Invalid Access token" from the agent | `access_aud` doesn't match the agent app's AUD tag, or wrong team domain |
| 503 "Agent unreachable" | PC asleep, agent not running, or tunnel down (`cloudflared tunnel info projectos-home`) |
| Start refused: port in use | Something else is on that port; the message names the PID |
