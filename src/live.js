// Talking to the real agent through the same-origin /api proxy (Cloudflare Pages Function).
import { MACHINES } from './data'

export async function api(path, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(path, { ...opts, signal: ctrl.signal, headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, credentials: 'same-origin' })
    const ct = r.headers.get('content-type') || ''
    const body = ct.includes('json') ? await r.json().catch(() => ({})) : await r.text()
    if (!r.ok) {
      const err = new Error((body && body.detail) || `HTTP ${r.status}`)
      err.status = r.status
      err.offline = r.status === 503 || (body && body.agentOffline)
      throw err
    }
    return body
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Agent did not answer in time')
      err.offline = true
      throw err
    }
    if (e instanceof TypeError) e.offline = true
    throw e
  } finally {
    clearTimeout(t)
  }
}

// Is a real agent behind /api? Anything else (file://, the artifact preview, a 404) means demo.
export async function detectAgent() {
  if (!/^https?:$/.test(location.protocol)) return null
  try {
    const info = await api('/api/agent', {}, 3000)
    return info && info.mode === 'live' ? info : null
  } catch (e) {
    return e.offline && e.status === 503 ? { mode: 'live', offline: true } : null
  }
}

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

export function toUiProject(p) {
  return {
    id: p.id,
    name: p.name,
    blurb: p.description || `${p.kind} project`,
    category: p.category,
    kind: p.kind,
    hue: hash(p.id) % 360,
    machine: MACHINES[p.machine] ? p.machine : 'desktop-01',
    cwd: p.cwd,
    exe: p.exe,
    args: p.args || [],
    port: p.port || null,
    udp: !!p.udp,
    health: p.health || null,
    frontend: p.frontend || null,
    repo: p.repo || 'not set',
    branch: '–',
    commit: '–',
    commitMsg: '',
    restart: p.restart || 'manual',
    gpu: !!p.gpu,
    exclusiveGpu: !!p.exclusiveGpu,
    profile: { cpu: 0, ram: p.profile?.ram || 0, vram: p.profile?.vram || 0 },
    deps: p.deps || [],
    env: p.env || {},
    job: !!p.job,
    interactive: !!p.interactive,
    profiles: p.profiles,
    bootMs: 0,
    bootLines: [],
    traffic: [],
    live: true,
  }
}

export function agentProject(info) {
  return {
    ...toUiProject({ id: 'projectos', name: 'ProjectOS Agent', description: 'The agent answering this dashboard.', category: 'tools', kind: 'Python', machine: info.machine, cwd: info.registry?.replace(/[\\/][^\\/]+$/, '') || '', exe: 'python.exe', args: ['-m', 'projectos_agent'], restart: 'always (Task Scheduler at logon)' }),
    self: true,
  }
}

export function toUiRuntime(rt, prev = {}) {
  const v = rt.status === 'running' || rt.status === 'unhealthy' ? rt.cpu || 0 : rt.status === 'starting' ? 20 : 0
  return {
    ...prev,
    status: rt.status === 'unhealthy' ? 'running' : rt.status,
    unhealthy: rt.status === 'unhealthy',
    phase: rt.phase,
    pid: rt.pid,
    startedAt: rt.startedAt,
    readyMs: rt.readyMs,
    lastExit: rt.lastExit,
    lastRunAt: rt.lastRunAt,
    failedAt: rt.failedAt,
    error: rt.error,
    health: rt.health,
    cpu: rt.cpu || 0,
    ram: rt.ram || 0,
    vram: rt.vram || 0,
    logs: prev.logs || [],
    hist: [...(prev.hist || Array(30).fill(0)).slice(-29), v],
  }
}

export function toUiActivity(items) {
  return items.map((a) => ({ ...a, type: a.action === 'Crash' ? 'crash' : a.action === 'Agent' ? 'access' : 'runtime' }))
}
