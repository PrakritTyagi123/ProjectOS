import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useStore, statusOf } from './store'
import { MACHINES } from './data'
import { Icon, Glyph, Button, Modal, Led, Knob, ago, useNow, uptime } from './ui'
import Overview from './Overview'
import ProjectPage from './ProjectPage'
import PlanPage from './PlanPage'
import ActivityPage from './ActivityPage'
import AddProject from './AddProject'

// ── hash routing: #overview, #plan, #activity, #project-<id> ──
function useRoute() {
  const read = () => (location.hash || '#overview').slice(1)
  const [r, set] = useState(read)
  useEffect(() => {
    const f = () => {
      set(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export const go = (h) => (location.hash = h)

const UiCtx = createContext(null)
export const useUi = () => useContext(UiCtx)

// Round power button used on modules and the project header.
export function Power({ p, big }) {
  const { state, engine } = useStore()
  const { requestStart } = useUi()
  const st = statusOf(state, p)
  const cls = 'power ' + (big ? 'power-big ' : '') + 'pw-' + st
  if (p.self)
    return (
      <span className={cls + ' pw-self'} title="Always on. Managed by Task Scheduler.">
        <Icon name="bolt" size={big ? 20 : 15} />
      </span>
    )
  const label = st === 'running' ? `Stop ${p.name}` : st === 'starting' ? `Cancel start of ${p.name}` : `${p.job ? 'Run' : 'Start'} ${p.name}`
  const onClick = () => {
    if (st === 'running' || st === 'starting') engine.stop(p.id)
    else if (st === 'stopped' || st === 'failed') requestStart(p.id)
  }
  return (
    <button className={cls} onClick={onClick} disabled={st === 'offline' || st === 'stopping'} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width={big ? 22 : 16} height={big ? 22 : 16} aria-hidden="true">
        <path d="M12 3v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M6.3 6.8a8 8 0 1 0 11.4 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  )
}

export function RunControls({ p }) {
  const { state, engine } = useStore()
  const { requestStart } = useUi()
  const st = statusOf(state, p)
  if (p.self) return <span className="always">Always on</span>
  return (
    <div className="ctl">
      {(st === 'stopped' || st === 'failed') && (
        <>
          <Button icon="play" variant="primary" onClick={() => requestStart(p.id)}>
            {p.job ? 'Run job' : st === 'failed' ? 'Try again' : 'Start'}
          </Button>
          {p.frontend && (
            <Button icon="open" onClick={() => requestStart(p.id, true)}>
              Start and open
            </Button>
          )}
        </>
      )}
      {st === 'starting' && (
        <Button icon="stop" onClick={() => engine.stop(p.id)}>
          Cancel
        </Button>
      )}
      {st === 'stopping' && <Button disabled>Stopping…</Button>}
      {st === 'running' && (
        <>
          <Button icon="stop" variant="danger" onClick={() => engine.stop(p.id)}>
            Stop
          </Button>
          <Button icon="restart" onClick={() => engine.restart(p.id)}>
            Restart
          </Button>
          {p.frontend && (
            <a className="btn btn-primary" href={p.frontend} target="_blank" rel="noopener noreferrer">
              <Icon name="open" />
              <span>Open app</span>
            </a>
          )}
        </>
      )}
      {st === 'offline' && (
        <Button icon="play" disabled>
          Start
        </Button>
      )}
    </div>
  )
}

function ConflictModal({ pending, onClose }) {
  const { state, engine } = useStore()
  const p = state.registry.find((x) => x.id === pending.id)
  const c = pending.conflict
  const names = c.holders.map((h) => h.name).join(' and ')
  const stopThenStart = () => {
    onClose()
    let left = c.holders.length
    c.holders.forEach((h) => engine.stop(h.id, { then: () => --left === 0 && engine.start(p.id, { open: pending.open }) }))
  }
  const total = c.total
  return (
    <Modal title="The GPU is busy" onClose={onClose}>
      <p>
        {p.name} needs about <b>{c.need.toFixed(1)} GB</b> of VRAM. {names} {c.holders.length > 1 ? 'are' : 'is'} holding <b>{c.used.toFixed(1)} GB</b> of the {total} GB on the RTX 4080.
      </p>
      <div className="vram-strip vram-modal">
        {c.holders.map((h) => (
          <span key={h.id} className="vs-seg" style={{ width: (h.profile.vram / total) * 100 + '%', '--h': h.hue }}>
            {h.name}
          </span>
        ))}
        <span className="vs-seg vs-new" style={{ width: (c.need / total) * 100 + '%', '--h': p.hue }}>
          {p.name}
        </span>
      </div>
      <div className="modal-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            onClose()
            engine.start(p.id, { open: pending.open })
          }}
        >
          Start anyway
        </Button>
        <Button variant="primary" icon="stop" onClick={stopThenStart}>
          Stop {names} and start
        </Button>
      </div>
    </Modal>
  )
}

function Toast() {
  const { state, engine } = useStore()
  const t = state.toast
  useEffect(() => {
    if (!t) return
    const h = setTimeout(engine.clearToast, 3800)
    return () => clearTimeout(h)
  }, [t?.id])
  if (!t) return null
  return (
    <div className={`toast toast-${t.tone}`} role="status" key={t.id}>
      <Icon name={t.tone === 'bad' ? 'warn' : 'check'} />
      <span>{t.text}</span>
    </div>
  )
}

// Theme: light / dark / system. One atomic swap of data-theme on <html>,
// revealed with a circular wipe from the button (View Transitions), or instantly where unsupported.
const THEME_KEY = 'projectos-theme'
function applyTheme(mode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}
function useTheme() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'system' } catch { return 'system' }
  })
  useLayoutEffect(() => {
    applyTheme(mode)
    try { localStorage.setItem(THEME_KEY, mode) } catch {}
  }, [mode])
  const change = (next, e) => {
    if (next === mode) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) return setMode(next)
    const r = e?.currentTarget?.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--vx', r ? r.left + r.width / 2 + 'px' : '50%')
    root.style.setProperty('--vy', r ? r.top + r.height / 2 + 'px' : '0px')
    document.startViewTransition(() => {
      applyTheme(next)
      flushSync(() => setMode(next))
    })
  }
  return [mode, change]
}

function ThemeSwitch() {
  const [mode, change] = useTheme()
  const opts = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'auto', 'Match system']]
  return (
    <div className="theme-sw" data-v={mode} role="radiogroup" aria-label="Theme">
      <span className="theme-knob" aria-hidden="true" />
      {opts.map(([k, ic, label]) => (
        <button key={k} role="radio" aria-checked={mode === k} aria-label={label} title={label} className={(mode === k ? 'on ' : '') + (k === 'system' ? 'sys' : '')} onClick={(e) => change(k, e)}>
          <Icon name={ic} />
        </button>
      ))}
    </div>
  )
}

function TopBar({ route, onAdd }) {
  const { state, engine } = useStore()
  useNow(5000)
  const desk = state.machines['desktop-01']
  const agent = state.runtime['projectos']
  const cur = route.startsWith('project-') || route.startsWith('readme-') ? 'overview' : route
  return (
    <header className="top">
      <div className="top-in">
        <a href="#overview" className="brand" aria-label="ProjectOS home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">ProjectOS</span>
        </a>
        <nav className="nav has-knob" aria-label="Main">
          <Knob variant="in" />
          {[
            ['overview', 'grid', 'Overview'],
            ['plan', 'flag', 'Plan'],
            ['activity', 'list', 'Activity'],
          ].map(([id, ic, label]) => (
            <a key={id} href={'#' + id} className={'nav-item ' + (cur === id ? 'on' : '')} aria-current={cur === id ? 'page' : undefined}>
              <Icon name={ic} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="top-right">
          <div className={'agent-chip ' + (desk ? '' : 'agent-off')} title={desk ? `Agent ${MACHINES['desktop-01'].agent}, tunnel connected` : `Last seen ${ago(state.lastSeen)}`}>
            <Led status={desk ? 'running' : 'offline'} />
            <b>desktop-01</b>
            <span className="agent-sub">{desk ? `up ${uptime(agent.startedAt)}` : 'asleep'}</span>
          </div>
          <ThemeSwitch />
          <label className="switch sleep-toggle" title="Demo: pretend the PC is asleep">
            <input id="sleep" type="checkbox" checked={!desk} onChange={(e) => engine.setMachine('desktop-01', !e.target.checked)} />
            <span>Sleep PC</span>
          </label>
          <Button icon="plus" variant="primary" onClick={onAdd}>
            <span className="hide-sm">Add project</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

// Soft light that follows the pointer across raised surfaces.
function usePointerLight() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return
    let last = null
    const move = (e) => {
      const el = e.target.closest?.('.panel, .hud-card, .mod, .pcard, .proj-hero')
      if (last && last !== el) last.classList.remove('lit')
      if (!el) return (last = null)
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', e.clientX - r.left + 'px')
      el.style.setProperty('--my', e.clientY - r.top + 'px')
      el.classList.add('lit')
      last = el
    }
    document.addEventListener('pointermove', move, { passive: true })
    return () => document.removeEventListener('pointermove', move)
  }, [])
}

export default function App() {
  usePointerLight()
  const route = useRoute()
  const { state, engine } = useStore()
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState(null)

  const requestStart = (id, open) => {
    const conflict = engine.vramConflict(id)
    if (conflict) setPending({ id, open, conflict })
    else engine.start(id, { open })
  }

  let page
  if (route.startsWith('project-') || route.startsWith('readme-')) {
    const isReadme = route.startsWith('readme-')
    const p = state.registry.find((x) => x.id === route.slice(isReadme ? 7 : 8))
    page = p ? <ProjectPage key={p.id} p={p} readme={isReadme} /> : <NotFound />
  } else if (route === 'plan') page = <PlanPage />
  else if (route === 'activity') page = <ActivityPage />
  else page = <Overview onAdd={() => setAdding(true)} />

  const desk = state.machines['desktop-01']
  return (
    <UiCtx.Provider value={{ requestStart }}>
      <div className="shell">
        <TopBar route={route} onAdd={() => setAdding(true)} />
        <main className="main">
          {!desk && (
            <div className="offline-banner" role="alert">
              <Icon name="warn" />
              <div>
                <b>desktop-01 is asleep or offline.</b> The dashboard still loads from Cloudflare, but nothing can start until the PC wakes and the agent reconnects. Last seen {ago(state.lastSeen)}.
              </div>
            </div>
          )}
          <div className="route" key={route.replace(/^readme-/, 'project-')}>
            {page}
          </div>
          <footer className="foot">
            Demo data. Nothing here touches a real machine.{' '}
            <button className="link" onClick={engine.reset}>
              Reset demo
            </button>
          </footer>
        </main>
      </div>
      {adding && <AddProject onClose={() => setAdding(false)} />}
      {pending && <ConflictModal pending={pending} onClose={() => setPending(null)} />}
      <Toast />
    </UiCtx.Provider>
  )
}

function NotFound() {
  return (
    <div className="page">
      <h1>No project at this address</h1>
      <p className="muted">It may have been removed from registry.yaml.</p>
      <a className="btn btn-primary" href="#overview">
        <Icon name="back" />
        <span>Back to overview</span>
      </a>
    </div>
  )
}
