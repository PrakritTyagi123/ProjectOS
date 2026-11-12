import { Fragment, useEffect, useRef, useState } from 'react'
import { useStore, statusOf } from './store'
import { CATEGORIES, MACHINES, PLAN_STATES } from './data'
import { Icon, Glyph, Status, Knob, LiveBars, Select, EmptyState, Skeleton, useFlip, uptime, ago, useNow } from './ui'
import { Actions, go } from './App'

const ORDER = { failed: 0, starting: 1, stopping: 1, running: 2, stopped: 3, offline: 4 }
const PRIO = { active: 0, committed: 1, queued: 2, parked: 3 }
const pref = (k, d) => {
  try { return localStorage.getItem(k) || d } catch { return d }
}
const save = (k, v) => {
  try { localStorage.setItem(k, v) } catch {}
}

function runMeta(p, r, st) {
  if (st === 'running') return `Up ${uptime(r.startedAt)}`
  if (st === 'starting') return 'Waiting for health check'
  if (st === 'stopping') return 'Stopping'
  if (st === 'failed') return `Failed ${ago(r.failedAt)}`
  if (st === 'offline') return MACHINES[p.machine].label
  if (p.job && r.lastRunAt) return `Ran ${ago(r.lastRunAt)}, exit ${r.lastExit}`
  return 'Idle'
}

function Detail({ p }) {
  const { state } = useStore()
  const r = state.runtime[p.id]
  const pl = state.plan[p.id]
  const st = statusOf(state, p)
  const last = r.logs[r.logs.length - 1]
  return (
    <div className="detail">
      <div className="detail-grid">
        <div>
          <p>{p.blurb}</p>
          <dl className="kvs">
            <div className="kv"><dt>Command</dt><dd><code>{p.exe.split('\\').pop()} {p.args.join(' ')}</code></dd></div>
            <div className="kv"><dt>Folder</dt><dd><code>{p.cwd}</code></dd></div>
            <div className="kv"><dt>Health</dt><dd>{p.health ? <code>{p.health}</code> : <span className="muted">None</span>}</dd></div>
            <div className="kv"><dt>App</dt><dd>{p.frontend ? <a href={p.frontend} target="_blank" rel="noopener noreferrer">{p.frontend.replace('https://', '')}</a> : <span className="muted">No web frontend</span>}</dd></div>
          </dl>
        </div>
        <div>
          <div className="inset-note">
            <span className="label">Next action</span>
            <p>{pl.next}</p>
          </div>
          {st === 'failed' ? (
            <div className="detail-err small">
              <Icon name="warn" size={14} />
              <span>{r.error} Full traceback in the workspace logs.</span>
            </div>
          ) : (
            last && <div className="detail-log"><code>{last.text}</code></div>
          )}
          <div className="row-btns">
            <a className="btn btn-sm" href={'#project-' + p.id}>
              <Icon name="grid" />
              <span>Workspace</span>
            </a>
            <a className="btn btn-sm" href={'#readme-' + p.id}>
              <Icon name="doc" />
              <span>README</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ p, open, toggle }) {
  const { state } = useStore()
  const r = state.runtime[p.id]
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  return (
    <>
      <tr data-flip={p.id} className={'prow ' + (open ? 'is-open ' : '') + 'st-' + st} onClick={toggle} aria-expanded={open}>
        <td className="c-chev">
          <Icon name="chev" size={12} className="chev" />
        </td>
        <td>
          <span className="cell-name">
            <Glyph p={p} size={26} />
            <span className="cell-stack">
              <a href={'#project-' + p.id} onClick={(e) => e.stopPropagation()}>
                {p.name}
              </a>
              <span className="small muted">
                {p.kind}
                {p.port ? `, ${p.udp ? 'UDP' : 'port'} ${p.port}` : ''}
              </span>
            </span>
          </span>
        </td>
        <td className="c-cat small muted">{CATEGORIES[p.category]}</td>
        <td>
          <span className={'prio prio-' + pl.state}>{PLAN_STATES[pl.state].label}</span>
        </td>
        <td>
          <Status status={st} />
          <div className="small muted">{runMeta(p, r, st)}</div>
        </td>
        <td className="c-spark">
          <LiveBars data={r.hist.slice(-20)} color="var(--accent)" />
        </td>
        <td className="r">
          <Actions p={p} />
        </td>
      </tr>
      {open && (
        <tr className="prow-detail">
          <td colSpan={7}>
            <Detail p={p} />
          </td>
        </tr>
      )}
    </>
  )
}

function Tile({ p }) {
  const { state } = useStore()
  const r = state.runtime[p.id]
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  return (
    <li className={'tile st-' + st} onClick={() => go('project-' + p.id)}>
      <div className="tile-h">
        <Glyph p={p} size={30} />
        <div className="cell-stack">
          <b>{p.name}</b>
          <span className="small muted">{p.kind}{p.port ? `, ${p.udp ? 'UDP' : 'port'} ${p.port}` : ''}</span>
        </div>
      </div>
      <div className="tile-viz">
        <LiveBars data={r.hist} color="var(--accent)" />
      </div>
      <div className="tile-st">
        <Status status={st} sub={runMeta(p, r, st)} />
        <span className={'prio prio-' + pl.state}>{PLAN_STATES[pl.state].label}</span>
      </div>
      <Actions p={p} />
    </li>
  )
}

export default function Projects({ onAdd }) {
  const { state } = useStore()
  useNow(1000)
  const [viewPref, setView] = useState(() => pref('projectos-view', 'list'))
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 700px)').matches)
  useEffect(() => {
    const mq = matchMedia('(max-width: 700px)')
    const f = () => setNarrow(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  // Phones always get cards; a wide table can't show its actions there.
  const view = narrow ? 'grid' : viewPref
  const [cat, setCat] = useState('all')
  const [stf, setStf] = useState('all')
  const [prio, setPrio] = useState('all')
  const [sort, setSort] = useState('status')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const list = state.registry.filter((p) => {
    const st = statusOf(state, p)
    if (cat !== 'all' && p.category !== cat) return false
    if (prio !== 'all' && state.plan[p.id].state !== prio) return false
    if (stf === 'running' && !['running', 'starting', 'stopping'].includes(st)) return false
    if (stf === 'stopped' && st !== 'stopped') return false
    if (stf === 'failed' && st !== 'failed') return false
    if (stf === 'offline' && st !== 'offline') return false
    if (q && !(p.name + ' ' + p.blurb + ' ' + p.kind).toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  list.sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : sort === 'priority' ? PRIO[state.plan[a.id].state] - PRIO[state.plan[b.id].state] || a.name.localeCompare(b.name) : ORDER[statusOf(state, a)] - ORDER[statusOf(state, b)] || a.name.localeCompare(b.name)
  )
  const setV = (v) => (setView(v), save('projectos-view', v))
  const body = useRef(null)
  useFlip(body, list.map((p) => p.id).join())
  const counts = state.registry.reduce((acc, p) => ((acc[statusOf(state, p)] = (acc[statusOf(state, p)] || 0) + 1), acc), {})

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted small">
            {state.registry.length} registered, {(counts.running || 0) + (counts.starting || 0)} running, {counts.failed || 0} failed. Priority and process state are separate: a parked project can still run.
          </p>
        </div>
      </header>

      <div className="filters panel-inset">
        <label className="search">
          <Icon name="search" />
          <input id="pf-q" type="search" placeholder="Filter projects" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Select id="pf-cat" label="Category" value={cat} onChange={setCat} options={[['all', 'All'], ...Object.entries(CATEGORIES)]} />
        <Select id="pf-prio" label="Priority" value={prio} onChange={setPrio} options={[['all', 'All'], ...Object.entries(PLAN_STATES).map(([k, v]) => [k, v.label])]} />
        <Select id="pf-sort" label="Sort" value={sort} onChange={setSort} options={[['status', 'Status'], ['priority', 'Priority'], ['name', 'Name']]} />
        <div className="seg has-knob" aria-label="Process state">
          <Knob />
          {['all', 'running', 'stopped', 'failed', 'offline'].map((k) => (
            <button key={k} className={stf === k ? 'on' : ''} onClick={() => setStf(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <div className="seg seg-icons has-knob" role="radiogroup" aria-label="View">
          <Knob />
          <button role="radio" aria-checked={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setV('list')} title="List" aria-label="List view">
            <Icon name="rows" />
          </button>
          <button role="radio" aria-checked={view === 'grid'} className={view === 'grid' ? 'on' : ''} onClick={() => setV('grid')} title="Grid" aria-label="Grid view">
            <Icon name="grid" />
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel">
          <EmptyState icon="search" title="No projects match these filters" action={<button className="btn btn-sm" onClick={() => (setCat('all'), setStf('all'), setPrio('all'), setQ(''))}>Clear filters</button>} />
        </div>
      ) : view === 'list' ? (
        <section className="panel flat-panel plist">
          <div className="table-wrap">
            <table className="dense projects-table">
              <thead>
                <tr>
                  <th className="c-chev" />
                  <th>Project</th>
                  <th className="c-cat">Category</th>
                  <th>Priority</th>
                  <th>Process</th>
                  <th className="c-spark">CPU</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody ref={body}>
                {!state.ready &&
                  [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <tr key={'sk' + i} className="sk-row">
                      <td colSpan={7}>
                        <Skeleton lines={1} h={22} />
                      </td>
                    </tr>
                  ))}
                {state.ready && list.map((p) => (
                  <Row key={p.id} p={p} open={open === p.id} toggle={() => setOpen(open === p.id ? null : p.id)} />
                ))}
              </tbody>
            </table>
          </div>
          <button className="add-row" onClick={onAdd}>
            <Icon name="plus" />
            <span>Register a project</span>
            <span className="muted small">Point the agent at an existing folder. No code changes.</span>
          </button>
        </section>
      ) : (
        <ul className="tiles">
          {list.map((p) => (
            <Tile key={p.id} p={p} />
          ))}
        </ul>
      )}
    </div>
  )
}
