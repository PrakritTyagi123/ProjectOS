import { createContext, useContext, useEffect, useState } from 'react'
import { useStore, statusOf } from './store'
import { MACHINES } from './data'
import { Icon, Glyph, Button, Modal, StatusPill, ago, useNow } from './ui'
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

// ── run controls with VRAM guard ──
const UiCtx = createContext(null)
export const useUi = () => useContext(UiCtx)

export function RunControls({ p, compact }) {
  const { state, engine } = useStore()
  const { requestStart } = useUi()
  const st = statusOf(state, p)
  if (p.self) return <span className="muted small">Always on</span>
  const label = (t) => (compact ? null : t)
  if (st === 'offline')
    return (
      <Button icon="play" disabled title="Machine offline">
        {label('Start')}
      </Button>
    )
  if (st === 'starting')
    return (
      <div className="ctl">
        <Button icon="stop" onClick={() => engine.stop(p.id)} aria-label={`Cancel start of ${p.name}`}>
          {label('Cancel')}
        </Button>
      </div>
    )
  if (st === 'stopping') return <Button disabled>{compact ? '…' : 'Stopping…'}</Button>
  if (st === 'running')
    return (
      <div className="ctl">
        <Button icon="stop" onClick={() => engine.stop(p.id)} aria-label={`Stop ${p.name}`}>
          {label('Stop')}
        </Button>
        {!compact && (
          <Button icon="restart" onClick={() => engine.restart(p.id)}>
            Restart
          </Button>
        )}
        {!compact && p.frontend && (
          <a className="btn btn-primary" href={p.frontend} target="_blank" rel="noopener noreferrer">
            <Icon name="open" />
            <span>Open app</span>
          </a>
        )}
      </div>
    )
  return (
    <div className="ctl">
      <Button icon="play" variant="primary" onClick={() => requestStart(p.id)} aria-label={`${p.job ? 'Run' : 'Start'} ${p.name}`}>
        {label(p.job ? 'Run job' : st === 'failed' ? 'Try again' : 'Start')}
      </Button>
      {!compact && p.frontend && (
        <Button icon="open" onClick={() => requestStart(p.id, true)}>
          Start and open
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
  return (
    <Modal title="The GPU is busy" onClose={onClose}>
      <p>
        {p.name} needs about <b>{c.need.toFixed(1)} GB</b> of VRAM. {names} {c.holders.length > 1 ? 'are' : 'is'} holding{' '}
        <b>{c.used.toFixed(1)} GB</b> of the {c.total} GB on the RTX 4080.
      </p>
      <div className="vram-compare">
        {c.holders.map((h) => (
          <div key={h.id} className="vc-row">
            <Glyph p={h} size={24} />
            <span>{h.name}</span>
            <span className="num">{h.profile.vram.toFixed(1)} GB</span>
          </div>
        ))}
        <div className="vc-row vc-new">
          <Glyph p={p} size={24} />
          <span>{p.name}</span>
          <span className="num">+{c.need.toFixed(1)} GB</span>
        </div>
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

function Sidebar({ route, onAdd, open, setOpen }) {
  const { state, engine } = useStore()
  useNow(5000)
  const desk = state.machines['desktop-01']
  const running = state.registry.filter((p) => !p.self && ['running', 'starting', 'stopping'].includes(statusOf(state, p)))
  const active = state.registry.find((p) => state.plan[p.id]?.state === 'active')
  const nav = [
    ['overview', 'grid', 'Overview'],
    ['plan', 'flag', 'Plan'],
    ['activity', 'list', 'Activity'],
  ]
  const cur = route.startsWith('project-') ? 'overview' : route
  return (
    <aside className={'side ' + (open ? 'side-open' : '')}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--ink)" />
            <path d="M8 7v10M8 7h4.5a3 3 0 0 1 0 6H8" stroke="var(--bg)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <circle cx="16.5" cy="16.5" r="1.8" fill="var(--accent)" />
          </svg>
        </span>
        <span className="brand-name">ProjectOS</span>
        <button className="icon-btn side-toggle" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          <Icon name={open ? 'x' : 'menu'} />
        </button>
      </div>
      <div className="side-body">
        <nav className="nav">
          {nav.map(([id, ic, label]) => (
            <a key={id} href={'#' + id} className={'nav-item ' + (cur === id ? 'on' : '')} onClick={() => setOpen(false)}>
              <Icon name={ic} />
              {label}
            </a>
          ))}
          <button className="nav-item" onClick={onAdd}>
            <Icon name="plus" />
            Add project
          </button>
        </nav>

        {active && (
          <div className="side-sec">
            <div className="side-h">Active project</div>
            <a href={'#project-' + active.id} className="side-proj" onClick={() => setOpen(false)}>
              <Glyph p={active} size={22} />
              <span>{active.name}</span>
            </a>
          </div>
        )}

        <div className="side-sec">
          <div className="side-h">Running now</div>
          {running.length === 0 && <div className="muted small side-empty">Nothing running. Backends start on demand.</div>}
          {running.map((p) => (
            <a key={p.id} href={'#project-' + p.id} className="side-proj" onClick={() => setOpen(false)}>
              <Glyph p={p} size={22} />
              <span>{p.name}</span>
              <StatusPill status={statusOf(state, p)} small />
            </a>
          ))}
        </div>

        <div className="side-foot">
          <div className={'agent-card ' + (desk ? '' : 'agent-off')}>
            <div className="agent-row">
              <span className={'beacon ' + (desk ? 'beacon-on' : '')} />
              <b>{MACHINES['desktop-01'].id}</b>
              <span className="muted small">{desk ? 'online' : 'offline'}</span>
            </div>
            <div className="muted small">{desk ? `Agent ${MACHINES['desktop-01'].agent}, tunnel connected` : `Last seen ${ago(state.lastSeen)}`}</div>
            <label className="switch">
              <input type="checkbox" checked={!desk} onChange={(e) => engine.setMachine('desktop-01', !e.target.checked)} />
              <span>Simulate PC asleep</span>
            </label>
          </div>
          <div className="demo-note">
            Demo data. Nothing here touches a real machine.{' '}
            <button className="link" onClick={engine.reset}>
              Reset demo
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function App() {
  const route = useRoute()
  const { state, engine } = useStore()
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState(null)
  const [menu, setMenu] = useState(false)

  const requestStart = (id, open) => {
    const conflict = engine.vramConflict(id)
    if (conflict) setPending({ id, open, conflict })
    else engine.start(id, { open })
  }

  let page
  if (route.startsWith('project-')) {
    const p = state.registry.find((x) => x.id === route.slice(8))
    page = p ? <ProjectPage key={p.id} p={p} /> : <NotFound />
  } else if (route === 'plan') page = <PlanPage />
  else if (route === 'activity') page = <ActivityPage />
  else page = <Overview onAdd={() => setAdding(true)} />

  const desk = state.machines['desktop-01']
  return (
    <UiCtx.Provider value={{ requestStart }}>
      <div className="shell">
        <Sidebar route={route} onAdd={() => setAdding(true)} open={menu} setOpen={setMenu} />
        <main className="main">
          {!desk && (
            <div className="offline-banner" role="alert">
              <Icon name="warn" />
              <div>
                <b>desktop-01 is offline.</b> This dashboard still loads from Cloudflare, but nothing can start until the PC is awake and the agent reconnects. Last seen {ago(state.lastSeen)}.
              </div>
            </div>
          )}
          {page}
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
      <h1>No project with that address</h1>
      <p className="muted">It may have been removed from registry.yaml.</p>
      <a className="btn btn-primary" href="#overview">
        <Icon name="back" />
        <span>Back to overview</span>
      </a>
    </div>
  )
}
