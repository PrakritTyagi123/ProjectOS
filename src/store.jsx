// Simulated agent. In the real app every function in `useEngine`
// becomes a fetch to /api/... and the TICK comes from polling
// GET /api/host/metrics and GET /api/projects.
import { createContext, useContext, useEffect, useReducer, useRef, useMemo } from 'react'
import { PROJECTS, INITIAL_PLAN, INITIAL_INBOX, MACHINES } from './data'
import { INITIAL_TASKS, INITIAL_DEPLOYS, INITIAL_JOBS, EXTRA_ACTIVITY, defaultModules, profilesFor } from './extra'

const MAX_LOG = 400
const HIST = 48
const STORE_KEY = 'projectos-demo-v2'

const rnd = (a, b) => a + Math.random() * (b - a)
const jitter = (v, pct = 0.15) => Math.max(0, v * (1 + rnd(-pct, pct)))
const pid = () => 1000 + Math.floor(Math.random() * 30000)
const line = (stream, text, t = Date.now()) => ({ t, stream, text })

function bootLog(p, t0) {
  const ex = p.exe.split('\\').pop()
  const out = [
    line('agent', `spawn ${ex} ${p.args.join(' ')}`, t0),
    line('agent', `cwd ${p.cwd}`, t0 + 20),
    line('agent', `job object attached`, t0 + 40),
  ]
  p.bootLines.forEach((l, i) => out.push(line('out', l, t0 + 400 + i * 600)))
  if (p.health) out.push(line('agent', `health GET ${p.health} → 200 in ${Math.round(rnd(3, 60))} ms`, t0 + p.bootMs))
  out.push(line('agent', `ready after ${(p.bootMs / 1000).toFixed(1)} s`, t0 + p.bootMs + 10))
  return out
}

function initialRuntime() {
  const now = Date.now()
  const rt = {}
  for (const p of PROJECTS) rt[p.id] = { status: 'stopped', logs: [], cpu: 0, ram: 0, vram: 0, lastExit: null, hist: Array(30).fill(0) }
  const run = (id, agoMin) => {
    const p = PROJECTS.find((x) => x.id === id)
    const t0 = now - agoMin * 60000
    const logs = bootLog(p, t0)
    for (let i = 0; i < 14 && p.traffic.length; i++) logs.push(line('out', p.traffic[i % p.traffic.length], t0 + p.bootMs + 60000 * (i + 1) * (agoMin / 16)))
    rt[id] = { ...rt[id], hist: Array.from({ length: 30 }, () => jitter(p.profile.cpu, 0.5)), status: 'running', pid: pid(), startedAt: t0, readyMs: p.bootMs, logs, ...p.profile, health: { ok: true, ms: 12, at: now } }
  }
  run('projectos', 60 * 26 + 12)
  run('comfyui', 38)
  run('hopper', 9)
  // A failed start from yesterday.
  const q = PROJECTS.find((x) => x.id === 'q-nivaran')
  const tq = now - 21 * 3600000
  rt['q-nivaran'] = {
    ...rt['q-nivaran'],
    status: 'failed',
    lastExit: 1,
    failedAt: tq + 2600,
    error: 'Process exited with code 1 before the health check passed.',
    logs: [
      line('agent', `spawn python.exe ${q.args.join(' ')}`, tq),
      line('agent', 'job object attached', tq + 30),
      line('out', 'Reading experiment config', tq + 900),
      ...q.failWith.map((l, i) => line('err', l, tq + 2400 + i)),
      line('agent', 'process exited with code 1', tq + 2600),
      line('agent', 'marked failed (never passed health check)', tq + 2601),
    ],
  }
  rt['nasa-power'].lastExit = 0
  rt['nasa-power'].lastRunAt = now - 3 * 86400000
  return rt
}

function initialActivity() {
  const now = Date.now()
  const m = (x) => now - x * 60000
  return [
    { t: m(9), who: 'Phone', action: 'Start', project: 'hopper', result: 'Ready in 5.0 s' },
    { t: m(38), who: 'Laptop', action: 'Start', project: 'comfyui', result: 'Ready in 9.0 s' },
    { t: m(52), who: 'Laptop', action: 'Stop', project: 'ai-companion', result: 'Stopped (graceful, 1.4 s)' },
    { t: m(140), who: 'Laptop', action: 'Start', project: 'ai-companion', result: 'Ready in 11.0 s' },
    { t: m(21 * 60), who: 'Phone', action: 'Start', project: 'q-nivaran', result: 'Failed: exit code 1', bad: true },
    { t: m(26 * 60 + 12), who: 'Windows logon', action: 'Start', project: 'projectos', result: 'Agent online' },
    { t: m(3 * 1440), who: 'Laptop', action: 'Run job', project: 'nasa-power', result: 'Exit 0 in 6.2 s' },
    { t: m(3 * 1440 + 30), who: 'Unknown device', action: 'Sign-in', project: null, result: 'Blocked by Cloudflare Access', bad: true },
  ]
}

const TYPE_OF = { Start: 'runtime', Stop: 'runtime', Restart: 'runtime', 'Run job': 'runtime', 'Sign-in': 'access', Register: 'registry', Redeploy: 'deploy' }
const withType = (a) => ({ machine: 'desktop-01', type: TYPE_OF[a.action] || 'runtime', ...a })

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function init() {
  const saved = loadSaved()
  return {
    registry: PROJECTS,
    machines: { 'desktop-01': true, 'office-ws': false },
    lastSeen: Date.now(),
    runtime: initialRuntime(),
    plan: saved?.plan || INITIAL_PLAN,
    inbox: saved?.inbox || INITIAL_INBOX,
    activity: [...initialActivity(), ...EXTRA_ACTIVITY].map(withType).sort((a, b) => b.t - a.t),
    tasks: saved?.tasks || INITIAL_TASKS,
    modules: saved?.modules || Object.fromEntries(PROJECTS.map((p) => [p.id, defaultModules(p)])),
    profile: saved?.profile || Object.fromEntries(PROJECTS.map((p) => [p.id, profilesFor(p)[0]])),
    deploys: INITIAL_DEPLOYS,
    jobs: INITIAL_JOBS,
    hist: { cpu: Array.from({ length: HIST }, () => rnd(14, 26)), gpu: Array.from({ length: HIST }, () => rnd(20, 45)) },
    toast: null,
  }
}

function reducer(s, a) {
  switch (a.type) {
    case 'RT': {
      const cur = s.runtime[a.id]
      return { ...s, runtime: { ...s.runtime, [a.id]: { ...cur, ...a.patch } } }
    }
    case 'LOG': {
      const cur = s.runtime[a.id]
      const logs = cur.logs.concat(a.lines).slice(-MAX_LOG)
      return { ...s, runtime: { ...s.runtime, [a.id]: { ...cur, logs } } }
    }
    case 'TICK': {
      const runtime = { ...s.runtime }
      let cpu = 9 + rnd(-2, 3)
      let gpu = 2
      for (const p of s.registry) {
        const r = runtime[p.id]
        if (r.status === 'running') {
          runtime[p.id] = {
            ...r,
            cpu: jitter(p.profile.cpu, 0.4),
            ram: jitter(p.profile.ram, 0.04),
            vram: jitter(p.profile.vram, 0.02),
            health: p.health ? { ok: true, ms: Math.round(rnd(2, 40)), at: Date.now() } : r.health,
          }
          cpu += runtime[p.id].cpu / 2
          if (p.gpu) gpu += p.profile.vram * rnd(2, 5)
        }
        const rr = runtime[p.id]
        const v = rr.status === 'running' ? rr.cpu : rr.status === 'starting' ? rnd(30, 80) : 0
        runtime[p.id] = { ...rr, hist: (rr.hist || []).slice(-29).concat(v) }
      }
      const jobs = s.jobs.map((j) => {
        if (j.state !== 'running') return j
        const progress = Math.min(1, j.progress + 0.012)
        return { ...j, progress, eta: Math.max(0, Math.round(j.eta * (1 - 0.012 / Math.max(0.01, 1 - j.progress)))), state: progress >= 1 ? 'done' : 'running' }
      })
      return {
        ...s,
        runtime,
        jobs,
        lastSeen: s.machines['desktop-01'] ? Date.now() : s.lastSeen,
        hist: { cpu: s.hist.cpu.slice(1).concat(Math.min(100, cpu)), gpu: s.hist.gpu.slice(1).concat(Math.min(100, gpu)) },
      }
    }
    case 'MACHINE':
      return { ...s, machines: { ...s.machines, [a.id]: a.online } }
    case 'ACT':
      return { ...s, activity: [withType({ t: Date.now(), who: 'This browser', ...a.entry }), ...s.activity].slice(0, 120) }
    case 'TASKS':
      return { ...s, tasks: a.tasks }
    case 'MODULES':
      return { ...s, modules: { ...s.modules, [a.id]: a.list } }
    case 'PROFILE':
      return { ...s, profile: { ...s.profile, [a.id]: a.value } }
    case 'DEPLOY':
      return { ...s, deploys: s.deploys.map((d) => (d.id === a.id ? { ...d, ...a.patch } : d)) }
    case 'JOB':
      return { ...s, jobs: s.jobs.map((j) => (j.id === a.id ? { ...j, ...a.patch } : j)) }
    case 'PLAN':
      return { ...s, plan: { ...s.plan, [a.id]: { ...s.plan[a.id], ...a.patch } } }
    case 'INBOX':
      return { ...s, inbox: a.inbox }
    case 'REGISTER':
      return {
        ...s,
        registry: [...s.registry, a.project],
        runtime: { ...s.runtime, [a.project.id]: { status: 'stopped', hist: Array(30).fill(0), logs: [line('agent', 'registered from dashboard (demo)')], cpu: 0, ram: 0, vram: 0 } },
        plan: { ...s.plan, [a.project.id]: { state: 'parked', milestone: 'Define first release', dod: [], next: 'Write the definition of done.', blocker: '', experiment: '', resume: '', ideas: [], sessions: [] } },
      }
    case 'TOAST':
      return { ...s, toast: a.toast ? { ...a.toast, id: Date.now() } : null }
    case 'RESET':
      return init()
    default:
      return s
  }
}

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const ref = useRef(state)
  ref.current = state
  const timers = useRef({})

  useEffect(() => {
    const iv = setInterval(() => {
      dispatch({ type: 'TICK' })
      // occasional traffic in logs
      const s = ref.current
      for (const p of s.registry) {
        const r = s.runtime[p.id]
        if (r.status === 'running' && !p.job && p.traffic?.length && Math.random() < 0.3) {
          dispatch({ type: 'LOG', id: p.id, lines: [line('out', p.traffic[Math.floor(Math.random() * p.traffic.length)])] })
        }
      }
    }, 1200)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ plan: state.plan, inbox: state.inbox, tasks: state.tasks, modules: state.modules, profile: state.profile }))
    } catch {}
  }, [state.plan, state.inbox, state.tasks, state.modules, state.profile])

  const engine = useMemo(() => {
    const get = (id) => ref.current.registry.find((p) => p.id === id)
    const later = (id, ms, fn) => {
      const h = setTimeout(fn, ms)
      ;(timers.current[id] ||= []).push(h)
    }
    const clear = (id) => {
      ;(timers.current[id] || []).forEach(clearTimeout)
      timers.current[id] = []
    }
    const toast = (text, tone = 'info') => dispatch({ type: 'TOAST', toast: { text, tone } })
    const online = (p) => ref.current.machines[p.machine]

    function start(id, { open } = {}) {
      const p = get(id)
      if (!online(p)) return toast(`${MACHINES[p.machine].label} is offline. Nothing was started.`, 'bad')
      clear(id)
      const t0 = Date.now()
      dispatch({ type: 'RT', id, patch: { status: 'starting', phase: 'spawn', startedAt: t0, error: null, pid: pid(), cpu: 0, ram: 0, vram: 0 } })
      dispatch({ type: 'LOG', id, lines: [line('agent', `── start requested from this browser (profile: ${ref.current.profile?.[id] || 'Default'}) ──`), line('agent', `spawn ${p.exe.split('\\').pop()} ${p.args.join(' ')}`), line('agent', 'job object attached')] })
      const step = p.bootMs / (p.bootLines.length + 2)
      later(id, 500, () => dispatch({ type: 'RT', id, patch: { phase: 'boot' } }))
      p.bootLines.forEach((l, i) => later(id, 500 + step * (i + 1), () => dispatch({ type: 'LOG', id, lines: [line('out', l)] })))

      if (p.failWith) {
        later(id, p.bootMs * 0.7, () => {
          dispatch({ type: 'LOG', id, lines: [...p.failWith.map((l) => line('err', l)), line('agent', 'process exited with code 1'), line('agent', 'marked failed (never passed health check)')] })
          dispatch({ type: 'RT', id, patch: { status: 'failed', phase: 'boot', lastExit: 1, failedAt: Date.now(), error: 'Process exited with code 1 before the health check passed.', cpu: 0, ram: 0, vram: 0 } })
          dispatch({ type: 'ACT', entry: { action: 'Start', project: id, result: 'Failed: exit code 1', bad: true } })
          toast(`${p.name} failed to start. See logs.`, 'bad')
        })
        return
      }
      later(id, p.bootMs * 0.85, () => {
        dispatch({ type: 'RT', id, patch: { phase: 'health' } })
        if (p.health) dispatch({ type: 'LOG', id, lines: [line('agent', `health GET ${p.health} → connection refused, retry in 1 s`)] })
      })
      later(id, p.bootMs, () => {
        const ms = Date.now() - t0
        dispatch({ type: 'LOG', id, lines: [p.health ? line('agent', `health GET ${p.health} → 200 in ${Math.round(rnd(3, 40))} ms`) : line('agent', 'no health check configured; process alive'), line('agent', `ready after ${(ms / 1000).toFixed(1)} s`)] })
        dispatch({ type: 'RT', id, patch: { status: 'running', phase: 'ready', readyMs: ms, ...p.profile, health: p.health ? { ok: true, ms: 9, at: Date.now() } : null } })
        dispatch({ type: 'ACT', entry: { action: p.job ? 'Run job' : 'Start', project: id, result: `Ready in ${(ms / 1000).toFixed(1)} s` } })
        toast(p.job ? `${p.name} is running.` : `${p.name} is ready.`, 'good')
        if (open && p.frontend) window.open(p.frontend, '_blank', 'noopener')
        if (p.job) {
          p.traffic.forEach((l, i) => later(id, 700 * (i + 1), () => dispatch({ type: 'LOG', id, lines: [line('out', l)] })))
          later(id, 700 * (p.traffic.length + 1), () => {
            dispatch({ type: 'LOG', id, lines: [line('agent', 'process exited with code 0')] })
            dispatch({ type: 'RT', id, patch: { status: 'stopped', lastExit: 0, lastRunAt: Date.now(), cpu: 0, ram: 0, vram: 0, pid: null } })
            toast(`${p.name} finished with exit 0.`, 'good')
          })
        }
      })
    }

    function stop(id, { quiet, then } = {}) {
      const p = get(id)
      if (p.self) return toast('The agent is managed by Windows Task Scheduler and can’t stop itself from here.', 'bad')
      if (!online(p)) return toast(`${MACHINES[p.machine].label} is offline.`, 'bad')
      clear(id)
      const t0 = Date.now()
      dispatch({ type: 'RT', id, patch: { status: 'stopping' } })
      dispatch({ type: 'LOG', id, lines: [line('agent', '── stop requested ──'), line('agent', 'sent CTRL_BREAK to process group, waiting up to 10 s')] })
      later(id, 1400, () => {
        dispatch({ type: 'LOG', id, lines: [line('out', 'Shutting down'), line('agent', `exited 0 after ${((Date.now() - t0) / 1000).toFixed(1)} s; job object closed, 0 orphans`)] })
        dispatch({ type: 'RT', id, patch: { status: 'stopped', pid: null, cpu: 0, ram: 0, vram: 0, lastExit: 0, phase: null } })
        if (!quiet) {
          dispatch({ type: 'ACT', entry: { action: 'Stop', project: id, result: 'Stopped (graceful, 1.4 s)' } })
          toast(`${p.name} stopped.`)
        }
        then && then()
      })
    }

    function restart(id) {
      dispatch({ type: 'ACT', entry: { action: 'Restart', project: id, result: 'Requested' } })
      stop(id, { quiet: true, then: () => start(id) })
    }

    // VRAM check before a GPU start.
    function vramConflict(id) {
      const p = get(id)
      if (!p.gpu) return null
      const s = ref.current
      const holders = s.registry.filter((x) => x.id !== id && x.gpu && ['running', 'starting'].includes(s.runtime[x.id].status))
      const used = holders.reduce((a, x) => a + x.profile.vram, 0)
      const total = MACHINES['desktop-01'].vramGb
      const need = p.profile.vram
      const exclusive = holders.filter((x) => x.exclusiveGpu)
      // Only suggest stopping what actually has to go.
      let toStop = []
      if (exclusive.length) toStop = exclusive
      else if (p.exclusiveGpu) toStop = holders
      else if (used + need > total - 0.5) {
        let free = total - 0.5 - used
        for (const h of [...holders].sort((a, b) => b.profile.vram - a.profile.vram)) {
          if (free >= need) break
          toStop.push(h)
          free += h.profile.vram
        }
      }
      if (!toStop.length) return null
      return { need, used: toStop.reduce((a, x) => a + x.profile.vram, 0), total, holders: toStop }
    }

    return {
      start,
      stop,
      restart,
      vramConflict,
      toast,
      setMachine: (id, on) => {
        dispatch({ type: 'MACHINE', id, online: on })
        toast(on ? 'Agent back online.' : 'Agent offline. Controls are disabled until it reconnects.', on ? 'good' : 'bad')
      },
      plan: (id, patch) => dispatch({ type: 'PLAN', id, patch }),
      // Only one Active project at a time; the rest is a priority label, independent of running state.
      movePlan: (id, to) => {
        const s = ref.current
        const p = get(id)
        if (to === 'active') {
          const cur = s.registry.find((x) => x.id !== id && s.plan[x.id].state === 'active')
          if (cur) return toast(`${cur.name} is still the active project. Ship it, or park it with a resume note, first.`, 'bad')
        }
        dispatch({ type: 'PLAN', id, patch: { state: to } })
        toast(`${p.name} moved to ${{ active: 'Active', committed: 'Committed', queued: 'Queued', parked: 'Parked' }[to]}.`)
      },
      inbox: (inbox) => dispatch({ type: 'INBOX', inbox }),
      tasks: (tasks) => dispatch({ type: 'TASKS', tasks }),
      modules: (id, list) => dispatch({ type: 'MODULES', id, list }),
      setProfile: (id, value) => dispatch({ type: 'PROFILE', id, value }),
      job: (id, patch) => dispatch({ type: 'JOB', id, patch }),
      redeploy: (id) => {
        dispatch({ type: 'DEPLOY', id, patch: { status: 'building', note: '' } })
        dispatch({ type: 'ACT', entry: { action: 'Redeploy', project: id, result: 'Build started on Cloudflare Pages', type: 'deploy' } })
        later('dep-' + id, 4200, () => {
          dispatch({ type: 'DEPLOY', id, patch: { status: 'live', at: Date.now() } })
          toast('Deployment is live.', 'good')
        })
      },
      register: (project) => {
        dispatch({ type: 'REGISTER', project })
        dispatch({ type: 'ACT', entry: { action: 'Register', project: project.id, result: 'Added to registry (demo)' } })
      },
      clearToast: () => dispatch({ type: 'TOAST', toast: null }),
      reset: () => {
        Object.keys(timers.current).forEach(clear)
        try { localStorage.removeItem(STORE_KEY) } catch {}
        dispatch({ type: 'RESET' })
      },
    }
  }, [])

  return <Ctx.Provider value={{ state, engine }}>{children}</Ctx.Provider>
}

// Derived status: a project on an offline machine is "offline" regardless.
export function statusOf(state, p) {
  if (!state.machines[p.machine]) return 'offline'
  return state.runtime[p.id].status
}
