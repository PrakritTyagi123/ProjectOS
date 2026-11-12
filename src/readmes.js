// Demo README content. In the real app the agent serves README.md (and
// docs/images/*) straight from each project's folder.
import { PROJECTS, CATEGORIES } from './data'

const svg = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)

const ARCH = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 360" font-family="Inter,Segoe UI,sans-serif">
<rect width="880" height="360" rx="24" fill="#e4e8ee"/>
<g font-size="15" font-weight="700" fill="#273041">
<rect x="30" y="140" width="170" height="80" rx="16" fill="#eef1f6" stroke="#c4cbd6"/><text x="115" y="176" text-anchor="middle">Browser / phone</text><text x="115" y="198" text-anchor="middle" font-size="12" font-weight="500" fill="#687285">Cloudflare Access</text>
<rect x="250" y="140" width="180" height="80" rx="16" fill="#eef1f6" stroke="#c4cbd6"/><text x="340" y="176" text-anchor="middle">Pages dashboard</text><text x="340" y="198" text-anchor="middle" font-size="12" font-weight="500" fill="#687285">/api/* Pages Function</text>
<rect x="480" y="140" width="150" height="80" rx="16" fill="#eef1f6" stroke="#c4cbd6"/><text x="555" y="176" text-anchor="middle">Tunnel</text><text x="555" y="198" text-anchor="middle" font-size="12" font-weight="500" fill="#687285">cloudflared</text>
<rect x="680" y="40" width="170" height="280" rx="18" fill="#dde2ea" stroke="#c4cbd6"/><text x="765" y="70" text-anchor="middle">desktop-01</text>
<rect x="698" y="88" width="134" height="44" rx="10" fill="#3d5fc4"/><text x="765" y="116" text-anchor="middle" fill="#fff" font-size="13">ProjectOS agent</text>
<rect x="698" y="146" width="134" height="36" rx="10" fill="#eef1f6"/><text x="765" y="169" text-anchor="middle" font-size="12" font-weight="600">ComfyUI :8188</text>
<rect x="698" y="192" width="134" height="36" rx="10" fill="#eef1f6"/><text x="765" y="215" text-anchor="middle" font-size="12" font-weight="600">AI Companion :8002</text>
<rect x="698" y="238" width="134" height="36" rx="10" fill="#eef1f6" stroke-dasharray="4 3" stroke="#9aa2b1"/><text x="765" y="261" text-anchor="middle" font-size="12" font-weight="600" fill="#687285">started on demand</text>
</g>
<g stroke="#3d5fc4" stroke-width="2.5" fill="none" marker-end="url(#a)"><path d="M200 180h44"/><path d="M430 180h44"/><path d="M630 180h44"/></g>
<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3d5fc4"/></marker></defs>
<text x="30" y="330" font-size="12" fill="#687285">Browser only ever sends a project id. Paths and commands stay in registry.yaml on the PC.</text>
</svg>`)

const CHAT = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 560" font-family="Inter,Segoe UI,sans-serif">
<rect width="380" height="560" rx="36" fill="#1f2229"/><rect x="14" y="14" width="352" height="532" rx="26" fill="#2a2e35"/>
<circle cx="56" cy="62" r="20" fill="#a497db"/><text x="86" y="58" fill="#e4e7ec" font-size="16" font-weight="700">Meera</text><text x="86" y="78" fill="#55c08e" font-size="12">online, local model</text>
<rect x="34" y="112" width="230" height="64" rx="16" fill="#353a43"/><text x="50" y="138" fill="#e4e7ec" font-size="13">Back already? How did the</text><text x="50" y="158" fill="#e4e7ec" font-size="13">ProjectOS sprint go today?</text>
<rect x="130" y="192" width="216" height="44" rx="16" fill="#7f9bf0"/><text x="148" y="219" fill="#16192a" font-size="13">Shipped the Access setup.</text>
<rect x="34" y="252" width="250" height="84" rx="16" fill="#353a43"/><text x="50" y="278" fill="#e4e7ec" font-size="13">Nice. That was the blocker</text><text x="50" y="298" fill="#e4e7ec" font-size="13">for v0.1. Want me to draft</text><text x="50" y="318" fill="#e4e7ec" font-size="13">the NEXT_STEP note?</text>
<rect x="34" y="486" width="312" height="42" rx="21" fill="#24282e"/><text x="56" y="512" fill="#737b88" font-size="13">Message Meera…</text>
</svg>`)

export const DEMO_ASSETS = {
  projectos: [{ id: 'arch', name: 'architecture.svg', data: ARCH, size: ARCH.length }],
  'ai-companion': [{ id: 'chat', name: 'android-chat.svg', data: CHAT, size: CHAT.length }],
}

const README = {
  projectos: `# ProjectOS

Start, stop and watch the backends of my own projects from one private dashboard, without keeping them all running.

![Architecture](asset:arch)

## What it does

- Starts a project's backend on my PC **on demand**, waits for its health check, then opens its app.
- Shows live logs, CPU, RAM and VRAM per project.
- Keeps one **Active** project at a time so I finish things.

## How it's built

| Part | Tech | Where it runs |
|---|---|---|
| Dashboard | React + Vite | Cloudflare Pages |
| API proxy | Pages Function | Cloudflare |
| Agent | Python, FastAPI, pywin32 Job Objects | desktop-01 |
| Tunnel | cloudflared | desktop-01 |

## Run locally

\`\`\`powershell
cd D:\\Projects\\ProjectOS\\agent
.venv\\Scripts\\python -m uvicorn agent.main:app --port 8765
\`\`\`

## v0.1 checklist

- [x] registry.yaml loads two real projects
- [x] Job Object process-tree stop
- [x] Health check decides ready
- [ ] Access in front of Pages and the tunnel
- [ ] Failure tests (crash, sleep, offline)

> **Rule:** v0.2 doesn't start until v0.1 is tagged. New ideas go to the inbox.
`,
  'ai-companion': `# AI Companion

Private character chat that runs on my own GPU. The Android app talks to the backend through a private Cloudflare hostname.

![Android chat screen](asset:chat)

## Features

- Streaming replies over WebSocket
- Six character profiles, each with its own memory
- Image generation per character (via ComfyUI)

## Models

| Model | Quant | VRAM |
|---|---|---|
| Qwen2.5 7B Instruct | Q4_K_M | ~6.9 GB |
| Llama 3.1 8B | Q5_K_M | ~8.1 GB |

## Start

\`\`\`powershell
.venv\\Scripts\\python run.py --config config\\local.yaml
\`\`\`

## Known issues

1. The Android app still has \`localhost\` hard-coded. Next release reads it from settings.
2. Chat history isn't backed up yet.
`,
}

export function defaultReadme(p) {
  if (README[p.id]) return README[p.id]
  const lines = [`# ${p.name}`, '', p.blurb, '', '## Run', '', '```powershell', `cd ${p.cwd}`, `& "${p.exe}" ${p.args.join(' ')}`, '```', '']
  lines.push('## Details', '', '| | |', '|---|---|', `| Category | ${CATEGORIES[p.category]} |`, `| Runtime | ${p.kind} |`)
  if (p.port) lines.push(`| Port | ${p.udp ? 'UDP ' : ''}${p.port} |`)
  if (p.health) lines.push(`| Health | \`${p.health}\` |`)
  if (p.frontend) lines.push(`| App | ${p.frontend} |`)
  lines.push(`| Repo | ${p.repo} |`, '', '## Screenshots', '', '_Drop images into the editor to add them here._', '')
  return lines.join('\n')
}

export const ALL_IDS = PROJECTS.map((p) => p.id)
