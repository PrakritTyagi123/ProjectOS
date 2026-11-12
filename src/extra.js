// More demo data: tasks, git, deployments, games, AI studio, modules, launch profiles.
// All placeholders. Replace with what the agent reports.
import { PROJECTS } from './data'

const H = 3600000
const D = 24 * H
const now = Date.now()

// ── modules: a project turns on what it needs; tabs follow ───
export const MODULES = {
  runtime: { label: 'Runtime', help: 'Start, stop, health checks and logs' },
  docs: { label: 'Docs', help: 'README with images, GIFs and video' },
  tasks: { label: 'Tasks', help: 'Board and milestones' },
  git: { label: 'Git', help: 'Branch, changes and commits' },
  deploy: { label: 'Deployments', help: 'Cloudflare Pages frontend' },
  models: { label: 'Models', help: 'Local model selection' },
  unity: { label: 'Unity', help: 'Scenes, builds and servers' },
  training: { label: 'Training', help: 'Training and evaluation jobs' },
}
export function defaultModules(p) {
  const m = ['runtime', 'docs', 'tasks', 'git']
  if (p.frontend) m.push('deploy')
  if (p.models) m.push('models')
  if (p.kind.startsWith('Unity')) m.push('unity')
  if (['forequast', 'hopper', 'q-nivaran'].includes(p.id)) m.push('training')
  return m
}

// ── launch profiles ──────────────────────────────────────────
export function profilesFor(p) {
  if (p.self || p.kind.startsWith('Unity') || p.job) return ['Default']
  if (p.category === 'ai') return ['Development', 'Production', 'Training', 'Evaluation']
  return ['Development', 'Production']
}

// ── resume / editor ──────────────────────────────────────────
export function editorFor(p) {
  if (p.kind.startsWith('Unity')) return 'Unity'
  if (p.id === 'comfyui') return 'ComfyUI'
  return 'VS Code'
}

// ── tasks ────────────────────────────────────────────────────
let n = 0
const t = (project, title, col, type = 'feature', extra = {}) => ({ id: 't' + ++n, project, title, col, type, ...extra })
export const INITIAL_TASKS = [
  t('projectos', 'Access application for control.example.com', 'doing', 'chore', { milestone: 'v0.1', due: now + 2 * D }),
  t('projectos', 'Service token on the Pages Function', 'todo', 'chore', { milestone: 'v0.1', due: now + 2 * D }),
  t('projectos', 'Test: agent offline while dashboard open', 'todo', 'test', { milestone: 'v0.1' }),
  t('projectos', 'Test: PC sleep mid-start', 'todo', 'test', { milestone: 'v0.1' }),
  t('projectos', 'Write NEXT_STEP.md and recovery notes', 'todo', 'docs', { milestone: 'v0.1', due: now + 6 * D }),
  t('projectos', 'Job Object process-tree stop', 'done', 'feature', { milestone: 'v0.1' }),
  t('projectos', 'Rotating log files 5 MB × 3', 'done', 'feature', { milestone: 'v0.1' }),
  t('projectos', 'Wake-on-LAN button', 'backlog', 'feature', { milestone: 'v0.2' }),
  t('projectos', 'Multi-PC agents', 'backlog', 'feature', { milestone: 'later' }),
  t('q-nivaran', 'Fix relative EXPERIMENT_CONFIG path', 'doing', 'bug', { milestone: 'QEC demo', due: now + 1 * D }),
  t('q-nivaran', 'Rerun surface code d=5', 'todo', 'feature', { milestone: 'QEC demo' }),
  t('ai-companion', 'API URL from settings, not localhost', 'todo', 'bug', { milestone: 'Usable chat app' }),
  t('ai-companion', 'Backend Offline screen in Android app', 'backlog', 'feature', { milestone: 'Usable chat app' }),
  t('ai-companion', 'Chat DB backup', 'backlog', 'chore', { milestone: 'Usable chat app' }),
  t('mall-manager', 'End-of-day summary screen', 'todo', 'feature', { milestone: 'Vertical slice' }),
  t('mall-manager', 'Windows build for a friend', 'backlog', 'chore', { milestone: 'Vertical slice' }),
  t('cp-server', 'Block A facades', 'backlog', 'feature', { milestone: 'Environment section' }),
  t('jewellery-store', 'Razorpay webhook handler', 'backlog', 'feature', { milestone: 'Checkout' }),
  t('hopper', 'Deploy frontend to Pages', 'backlog', 'chore', { milestone: 'Public demo' }),
]
export const TASK_COLS = [
  ['backlog', 'Backlog'],
  ['todo', 'To do'],
  ['doing', 'In progress'],
  ['done', 'Done'],
]
export const TASK_TYPES = { feature: 'Feature', bug: 'Bug', chore: 'Chore', test: 'Test', docs: 'Docs' }

// ── git ──────────────────────────────────────────────────────
const MSGS = {
  projectos: ['Add Job Object wrapper for child process cleanup', 'Pages Function proxy for /api/*', 'Bounded log rotation', 'Health check loop with timeout', 'registry.yaml schema'],
  'ai-companion': ['Stream tokens over WebSocket', 'Character memory per profile', 'Fix reconnect loop', 'Model config in local.yaml'],
  'q-nivaran': ['Move experiment configs under configs/', 'Surface code d=5 circuit', 'Plot logical error rate'],
  'mall-manager': ['Shop rent tick + tenant happiness', 'Placement grid snapping', 'Tenant AI wander'],
}
export const GIT = Object.fromEntries(
  PROJECTS.map((p, i) => {
    const msgs = MSGS[p.id] || [p.commitMsg || 'Initial commit', 'Update README', 'Tidy config']
    return [
      p.id,
      {
        remote: p.repo,
        branch: p.branch,
        dirty: [3, 0, 2, 0, 5, 1, 0, 0, 0, 1, 0, 0][i] || 0,
        ahead: [1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0][i] || 0,
        behind: [0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0][i] || 0,
        commits: msgs.map((m, j) => ({ sha: (p.commit && p.commit !== '–' ? p.commit : 'a1b2c3d').slice(0, 5) + 'abcdef'[j] + j, msg: m, at: now - (j * 1.7 + i * 0.6 + 0.2) * D })),
      },
    ]
  })
)

// ── deployments ──────────────────────────────────────────────
export const INITIAL_DEPLOYS = PROJECTS.filter((p) => p.frontend).map((p, i) => ({
  id: p.id,
  host: p.frontend.replace('https://', ''),
  pages: p.id + '-web',
  branch: 'main',
  status: p.id === 'jewellery-store' ? 'failed' : 'live',
  commit: (p.commit || 'abc1234').slice(0, 7),
  at: now - (i * 2.3 + 0.5) * D,
  access: p.id !== 'hopper',
  note: p.id === 'jewellery-store' ? 'Build failed: VITE_MEDUSA_URL missing' : '',
}))

// ── games ────────────────────────────────────────────────────
export const GAMES = {
  'mall-manager': {
    editor: '6000.0.32f1',
    scenes: ['Slice', 'MainMenu', 'Sandbox_Tenants', 'Test_Placement'],
    builds: [
      { ver: '0.3.0', target: 'Windows x64', size: '412 MB', at: now - 5 * D, ok: true },
      { ver: '0.2.1', target: 'Windows x64', size: '398 MB', at: now - 26 * D, ok: true },
    ],
  },
  'cp-server': {
    editor: '6000.0.32f1',
    scenes: ['RajivChowk_InnerCircle', 'Lobby', 'NetTest'],
    builds: [
      { ver: 'srv-0.4', target: 'Windows Server', size: '86 MB', at: now - 9 * D, ok: true },
      { ver: 'srv-0.5', target: 'Windows Server', size: '–', at: now - 2 * D, ok: false, note: 'IL2CPP: missing NetCode assembly reference' },
    ],
    players: [],
  },
}

// ── AI studio ────────────────────────────────────────────────
export const INITIAL_JOBS = [
  { id: 'j1', project: 'hopper', name: 'Population DQN, gen 1451 to 1600', kind: 'Training', progress: 0.34, eta: 52, gpu: true, state: 'paused' },
  { id: 'j2', project: 'forequast', name: 'Hybrid model eval, 2025 monsoon', kind: 'Evaluation', progress: 1, eta: 0, gpu: true, state: 'done', note: 'Office machine' },
  { id: 'j3', project: 'q-nivaran', name: 'Surface code d=5 sweep', kind: 'Experiment', progress: 0, eta: 95, gpu: false, state: 'queued' },
]
export const WORKFLOWS = [
  { name: 'episode_vertical_9x16', nodes: 42, last: now - 1 * D },
  { name: 'character_portrait_sdxl', nodes: 18, last: now - 3 * D },
  { name: 'thumbnail_bg_upscale', nodes: 11, last: now - 6 * D },
]

// ── extended activity ────────────────────────────────────────
export const EXTRA_ACTIVITY = [
  { t: now - 2 * H, who: 'desktop-01', machine: 'desktop-01', type: 'commit', action: 'Commit', project: 'projectos', result: 'Pages Function proxy for /api/*' },
  { t: now - 26 * H, who: 'desktop-01', machine: 'desktop-01', type: 'session', action: 'Session', project: 'projectos', result: '60 min: bounded log rotation' },
  { t: now - 2 * D, who: 'desktop-01', machine: 'desktop-01', type: 'build', action: 'Build', project: 'cp-server', result: 'Failed: IL2CPP missing reference', bad: true },
  { t: now - 3.2 * D, who: 'desktop-01', machine: 'desktop-01', type: 'milestone', action: 'Milestone', project: 'projectos', result: 'Health check decides ready' },
  { t: now - 4 * D, who: 'office-ws', machine: 'office-ws', type: 'training', action: 'Evaluation', project: 'forequast', result: 'Finished: 2025 monsoon eval' },
  { t: now - 5 * D, who: 'desktop-01', machine: 'desktop-01', type: 'crash', action: 'Crash', project: 'comfyui', result: 'CUDA out of memory, restarted manually', bad: true },
]
