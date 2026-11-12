import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useStore, statusOf } from './store'
import { MACHINES } from './data'
import { Icon, Glyph, Button, Modal, Led, Knob, Menu, ago, useNow, uptime } from './ui'
import Overview from './Overview'
import Projects from './Projects'
import ProjectPage from './ProjectPage'
import PlanPage from './PlanPage'
import Runtime from './Runtime'
import Machines from './Machines'
import Deploy from './Deploy'
import ActivityPage from './ActivityPage'
import Tasks from './Tasks'
import Repos from './Repos'
import Games from './Games'
import AIStudio from './AIStudio'
import Settings from './Settings'
import AddProject from './AddProject'

// ── hash routing ─────────────────────────────────────────────
function useRoute() {
  const read = () => (location.hash || '#overview').slice(1)
  const [r, set] = useState(read)
  useEffect(() => {
    const f = () => {
      set(read())
      document.querySelector('.ws-scroll')?.scrollTo(0, 0)
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

const store = {
  get: (k, d) => {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
  },
}

// ── theme: one atomic swap, revealed with a circular wipe ────
const THEME_KEY = 'projectos-theme'
function applyTheme(mode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}
export function useTheme() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'system' } catch { return 'system' }
  })
  useLayoutEffect(() => {
    applyTheme(mode)
    try { localStorage.setItem(THEME_KEY, mode) } catch {}
    const f = () => setMode(localStorage.getItem(THEME_KEY) || 'system')
    window.addEventListener('projectos-theme', f)
    return () => window.removeEventListener('projectos-theme', f)
  }, [mode])
  const change = (next, e) => {
    if (next === mode) return
    const done = () => {
      applyTheme(next)
      try { localStorage.setItem(THEME_KEY, next) } catch {}
      flushSync(() => setMode(next))
      window.dispatchEvent(new Event('projectos-theme'))
    }
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return done()
    const r = e?.currentTarget?.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--vx', r ? r.left + r.width / 2 + 'px' : '50%')
    root.style.setProperty('--vy', r ? r.top + r.height / 2 + 'px' : '0px')
    document.startViewTransition(done)
  }
  return [mode, change]
}

export function ThemeSwitch() {
  const [mode, change] = useTheme()
  const opts = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'auto', 'Match system']]
  return (
    <div className="seg seg-icons has-knob" role="radiogroup" aria-label="Theme">
      <Knob />
      {opts.map(([k, ic, label]) => (
        <button key={k} role="radio" aria-checked={mode === k} aria-label={label} title={label} className={mode === k ? 'on' : ''} onClick={(e) => change(k, e)}>
          <Icon name={ic} />
        </button>
      ))}
    </div>
  )
}

// ── project actions: Start / Stop / Open / More ─────────────
export function Actions({ p, size = 'sm', more = true, open = true }) {
  const { state, engine } = useStore()
  const { requestStart } = useUi()
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  const sm = size === 'sm' ? ' btn-sm' : ''
  let primary
  if (p.self) primary = <span className="always">Always on</span>
  else if (st === 'running')
    primary = (
      <button className={'btn' + sm} onClick={() => engine.stop(p.id)}>
        <Icon name="stop" />
        <span>Stop</span>
      </button>
    )
  else if (st === 'starting')
    primary = (
      <button className={'btn' + sm} onClick={() => engine.stop(p.id)}>
        <span className="spin" aria-hidden="true" />
        <span>Cancel</span>
      </button>
    )
  else if (st === 'stopping')
    primary = (
      <button className={'btn' + sm} disabled>
        <span className="spin" aria-hidden="true" />
        <span>Stopping</span>
      </button>
    )
  else
    primary = (
      <button className={'btn btn-primary' + sm} disabled={st === 'offline'} title={st === 'offline' ? `${MACHINES[p.machine].label} is offline` : ''} onClick={() => requestStart(p.id)}>
        <Icon name={st === 'failed' ? 'restart' : 'play'} />
        <span>{p.job ? 'Run' : st === 'failed' ? 'Retry' : 'Start'}</span>
      </button>
    )
  const moves = ['active', 'committed', 'queued', 'parked'].filter((k) => k !== pl.state)
  return (
    <div className="actions" onClick={(e) => e.stopPropagation()}>
      {primary}
      {open && p.frontend && (
        st === 'running' ? (
          <a className={'btn' + sm} href={p.frontend} target="_blank" rel="noopener noreferrer">
            <Icon name="open" />
            <span>Open</span>
          </a>
        ) : (
          <button className={'btn' + sm} disabled={st === 'offline' || st === 'stopping'} onClick={() => requestStart(p.id, true)} title="Start the backend, wait until healthy, then open the app">
            <Icon name="open" />
            <span>Start and open</span>
          </button>
        )
      )}
      {more && (
        <Menu
          items={[
            { label: 'Open workspace', icon: 'grid', onClick: () => go('project-' + p.id) },
            { label: 'README', icon: 'doc', onClick: () => go('readme-' + p.id) },
            st === 'running' && !p.self && { label: 'Restart', icon: 'restart', onClick: () => engine.restart(p.id) },
            '-',
            { head: 'Move to' },
            ...moves.map((k) => ({
              label: { active: 'Active', committed: 'Committed', queued: 'Queued', parked: 'Parked' }[k],
              icon: 'flag',
              onClick: () => engine.movePlan(p.id, k),
            })),
          ]}
        />
      )}
    </div>
  )
}

// ── VRAM conflict ────────────────────────────────────────────
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
  return (
    <Modal title="The GPU is busy" onClose={onClose}>
      <p>
        {p.name} needs about <b>{c.need.toFixed(1)} GB</b> of VRAM. {names} {c.holders.length > 1 ? 'are' : 'is'} holding <b>{c.used.toFixed(1)} GB</b> of the {c.total} GB on the RTX 4080.
      </p>
      <div className="vram-strip vram-modal">
        {c.holders.map((h) => (
          <span key={h.id} className="vs-seg" style={{ width: (h.profile.vram / c.total) * 100 + '%' }}>
            {h.name}
          </span>
        ))}
        <span className="vs-seg vs-new" style={{ width: (c.need / c.total) * 100 + '%' }}>
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

// ── sidebar ──────────────────────────────────────────────────
const NAV = [
  ['overview', 'grid', 'Overview', 'Workspace'],
  ['projects', 'rows', 'Projects'],
  ['focus', 'flag', 'Focus & Plan'],
  ['tasks', 'check', 'Tasks'],
  ['runtime', 'pulse', 'Runtime', 'Development'],
  ['machines', 'folder', 'Machines'],
  ['repos', 'git', 'Repositories'],
  ['deploy', 'cloud', 'Deployments'],
  ['games', 'game', 'Games', 'Tools & system'],
  ['ai', 'chip', 'AI Studio'],
  ['activity', 'clock', 'Activity'],
  ['settings', 'cog', 'Settings'],
]
export const section = (route) => (route.startsWith('project-') || route.startsWith('readme-') ? 'projects' : route === 'plan' ? 'focus' : NAV.some((n) => n[0] === route) ? route : 'overview')

function Sidebar({ route, collapsed, setCollapsed, drawer, setDrawer }) {
  const { state } = useStore()
  useNow(5000)
  const cur = section(route)
  const desk = state.machines['desktop-01']
  const running = state.registry.filter((p) => ['running', 'starting', 'stopping'].includes(statusOf(state, p)))
  const failed = state.registry.filter((p) => statusOf(state, p) === 'failed').length
  const counts = { projects: state.registry.length, runtime: running.length }
  const doing = state.tasks.filter((t) => t.col === 'doing').length
  return (
    <aside className={'sb ' + (collapsed ? 'sb-collapsed ' : '') + (drawer ? 'sb-drawer' : '')} aria-label="Sidebar">
      <div className="sb-head">
        <a href="#overview" className="brand" aria-label="ProjectOS">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">ProjectOS</span>
        </a>
        <button className="btn btn-icon btn-sm sb-collapse" onClick={() => (drawer ? setDrawer(false) : setCollapsed(!collapsed))} aria-label={drawer ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name={drawer ? 'x' : 'sidebar'} />
        </button>
      </div>
      <nav className="sb-nav has-knob" aria-label="Main">
        <Knob variant="in" />
        {NAV.map(([id, ic, label, group]) => [
          group && <div key={'g-' + group} className="sb-group">{group}</div>,
          <a key={id} href={'#' + id} className={'sb-item ' + (cur === id ? 'on' : '')} aria-current={cur === id ? 'page' : undefined} title={collapsed ? label : undefined} onClick={() => setDrawer(false)}>
            <Icon name={ic} />
            <span className="sb-label">{label}</span>
            {counts[id] != null && <span className="sb-count num">{counts[id]}</span>}
            {id === 'projects' && failed > 0 && <span className="sb-alert" title={`${failed} failed`} />}
            {id === 'tasks' && doing > 0 && <span className="sb-count num">{doing}</span>}
          </a>,
        ])}
      </nav>
      <div className="sb-sec">
        <div className="sb-h">Running</div>
        <ul className="sb-list">
          {running.map((p) => (
            <li key={p.id}>
              <a href={'#project-' + p.id} title={p.name} onClick={() => setDrawer(false)}>
                <Led status={statusOf(state, p)} />
                <span className="sb-label">{p.name}</span>
                <span className="sb-meta num">{state.runtime[p.id].status === 'running' ? uptime(state.runtime[p.id].startedAt) : '…'}</span>
              </a>
            </li>
          ))}
          {running.length === 0 && <li className="sb-empty">Nothing running</li>}
        </ul>
      </div>
      <div className="sb-foot">
        <a href="#machines" className={'sb-machine ' + (desk ? '' : 'off')} title={collapsed ? `desktop-01 ${desk ? 'online' : 'offline'}` : undefined} onClick={() => setDrawer(false)}>
          <Led status={desk ? 'running' : 'offline'} />
          <span className="sb-label">
            <b>desktop-01</b>
            <span>{desk ? `Agent online, up ${uptime(state.runtime.projectos.startedAt)}` : `Offline, seen ${ago(state.lastSeen)}`}</span>
          </span>
        </a>
      </div>
    </aside>
  )
}

// ── toolbar with project jump search ─────────────────────────
const TITLES = Object.fromEntries(NAV.map((n) => [n[0], n[2]]))

function Jump() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef(null)
  const list = q ? state.registry.filter((p) => (p.name + ' ' + p.kind + ' ' + p.blurb).toLowerCase().includes(q.toLowerCase())).slice(0, 7) : []
  useEffect(() => {
    const k = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const pick = (p) => {
    go('project-' + p.id)
    setQ('')
    setOpen(false)
    ref.current?.blur()
  }
  return (
    <div className="jump">
      <label className="search">
        <Icon name="search" />
        <input
          ref={ref}
          id="jump"
          type="search"
          placeholder="Jump to project"
          value={q}
          autoComplete="off"
          onChange={(e) => (setQ(e.target.value), setOpen(true), setHi(0))}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setHi(Math.min(hi + 1, list.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setHi(Math.max(hi - 1, 0)))
            if (e.key === 'Enter' && list[hi]) pick(list[hi])
            if (e.key === 'Escape') (setQ(''), e.target.blur())
          }}
          aria-label="Jump to project"
        />
        <kbd>/</kbd>
      </label>
      {open && list.length > 0 && (
        <ul className="jump-list" role="listbox">
          {list.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === hi}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className={i === hi ? 'hi' : ''}>
                <Led status={statusOf(state, p)} />
                <span>{p.name}</span>
                <span className="muted small">{p.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toolbar({ route, onAdd, onMenu }) {
  const { state } = useStore()
  const sec = section(route)
  const p = (route.startsWith('project-') || route.startsWith('readme-')) && state.registry.find((x) => x.id === route.replace(/^(project|readme)-/, ''))
  return (
    <header className="tb">
      <button className="btn btn-icon btn-sm tb-menu" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {p ? (
          <>
            <a href="#projects">Projects</a>
            <Icon name="chev" size={12} />
            <span>{p.name}</span>
          </>
        ) : (
          <span>{TITLES[sec]}</span>
        )}
      </nav>
      <div className="tb-right">
        <Jump />
        <ThemeSwitch />
        <Button icon="plus" variant="primary" onClick={onAdd}>
          <span className="hide-sm">Add project</span>
        </Button>
      </div>
    </header>
  )
}

export default function App() {
  const route = useRoute()
  const { state, engine } = useStore()
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState(null)
  const [collapsed, setCollapsedRaw] = useState(() => store.get('projectos-sidebar', false))
  const [drawer, setDrawer] = useState(false)
  const setCollapsed = (v) => (setCollapsedRaw(v), store.set('projectos-sidebar', v))

  const requestStart = (id, open) => {
    const conflict = engine.vramConflict(id)
    if (conflict) setPending({ id, open, conflict })
    else engine.start(id, { open })
  }

  let page
  const sec = section(route)
  if (route.startsWith('project-') || route.startsWith('readme-')) {
    const isReadme = route.startsWith('readme-')
    const p = state.registry.find((x) => x.id === route.slice(isReadme ? 7 : 8))
    page = p ? <ProjectPage key={p.id} p={p} readme={isReadme} /> : <NotFound />
  } else if (sec === 'projects') page = <Projects onAdd={() => setAdding(true)} />
  else if (sec === 'focus') page = <PlanPage />
  else if (sec === 'runtime') page = <Runtime />
  else if (sec === 'machines') page = <Machines />
  else if (sec === 'deploy') page = <Deploy />
  else if (sec === 'tasks') page = <Tasks />
  else if (sec === 'repos') page = <Repos />
  else if (sec === 'games') page = <Games />
  else if (sec === 'ai') page = <AIStudio />
  else if (sec === 'activity') page = <ActivityPage />
  else if (sec === 'settings') page = <Settings collapsed={collapsed} setCollapsed={setCollapsed} />
  else page = <Overview />

  const desk = state.machines['desktop-01']
  return (
    <UiCtx.Provider value={{ requestStart, openAdd: () => setAdding(true) }}>
      <div className={'shell ' + (collapsed ? 'is-collapsed' : '')}>
        <Sidebar route={route} collapsed={collapsed && !drawer} setCollapsed={setCollapsed} drawer={drawer} setDrawer={setDrawer} />
        {drawer && <div className="sb-scrim" onClick={() => setDrawer(false)} />}
        <div className="ws">
          <Toolbar route={route} onAdd={() => setAdding(true)} onMenu={() => setDrawer(true)} />
          <main className="main">
            {!desk && (
              <div className="banner banner-bad" role="alert">
                <Icon name="warn" />
                <div>
                  <b>desktop-01 is asleep or offline.</b> The dashboard still loads from Cloudflare, but nothing can start until the PC wakes and the agent reconnects. Last seen {ago(state.lastSeen)}.
                </div>
                <button className="link" onClick={() => engine.setMachine('desktop-01', true)}>
                  Wake (demo)
                </button>
              </div>
            )}
            <div className="route" key={route.replace(/^readme-/, 'project-')}>
              {page}
            </div>
          </main>
        </div>
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
      <a className="btn btn-primary" href="#projects">
        <Icon name="back" />
        <span>All projects</span>
      </a>
    </div>
  )
}
