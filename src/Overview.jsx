import { useState } from 'react'
import { useStore, statusOf } from './store'
import { CATEGORIES, MACHINES } from './data'
import { Icon, Glyph, StatusPill, PlanChip, Sparkline, Button, uptime, ago, useNow, gb } from './ui'
import { RunControls } from './App'

export function FocusBand() {
  const { state } = useStore()
  const p = state.registry.find((x) => state.plan[x.id]?.state === 'active')
  if (!p) {
    return (
      <section className="focus focus-empty">
        <div>
          <h2>No active project</h2>
          <p>Pick one queued project and give it a small, finishable milestone.</p>
        </div>
        <a className="btn btn-primary" href="#plan">Choose on the plan</a>
      </section>
    )
  }
  const pl = state.plan[p.id]
  const done = pl.dod.filter((d) => d.d).length
  return (
    <section className="focus" aria-label="Active project">
      <div className="focus-main">
        <div className="focus-top">
          <span className="focus-tag">Active project</span>
          {pl.sprint && (
            <span className="focus-sprint">
              Day {pl.sprint.day} of {pl.sprint.of}
            </span>
          )}
        </div>
        <h2>
          <a href={'#project-' + p.id}>{p.name.replace(' Agent', '')}</a>
          <span className="focus-ms">{pl.milestone}</span>
        </h2>
        <div className="focus-next">
          <span className="focus-next-l">Next action</span>
          <p>{pl.next}</p>
        </div>
        {pl.blocker && (
          <div className="focus-block">
            <Icon name="warn" />
            <span>
              <b>Blocked:</b> {pl.blocker}
            </span>
          </div>
        )}
      </div>
      <div className="focus-dod">
        <div className="focus-count">
          <span className="big">{done}</span>
          <span>of {pl.dod.length} done</span>
        </div>
        <ol className="dod-ticks">
          {pl.dod.map((d, i) => (
            <li key={i} className={d.d ? 'on' : ''} title={d.t}>
              <span className="tick" />
              <span className="dod-t">{d.t}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function MachinePanel() {
  const { state } = useStore()
  useNow(2000)
  const m = MACHINES['desktop-01']
  const on = state.machines['desktop-01']
  const procs = state.registry.filter((p) => p.machine === 'desktop-01' && state.runtime[p.id].status === 'running')
  const ram = 7.2 + procs.reduce((a, p) => a + state.runtime[p.id].ram, 0)
  const vramUsers = procs.filter((p) => state.runtime[p.id].vram > 0)
  const vramUsed = 0.6 + vramUsers.reduce((a, p) => a + state.runtime[p.id].vram, 0)
  const cpuNow = state.hist.cpu[state.hist.cpu.length - 1]
  const gpuNow = state.hist.gpu[state.hist.gpu.length - 1]
  const counts = state.registry.reduce((a, p) => {
    const s = statusOf(state, p)
    a[s] = (a[s] || 0) + 1
    return a
  }, {})

  return (
    <section className={'panel machine ' + (on ? '' : 'is-off')} aria-label="Machine">
      <header className="panel-h">
        <div>
          <h3>{m.id}</h3>
          <span className="muted small">
            {m.os}, {m.gpu} {m.vramGb} GB
          </span>
        </div>
        <span className={'pill ' + (on ? 'pill-good' : 'pill-off')}>
          <span className="dot" />
          {on ? 'Agent online' : 'Offline'}
        </span>
      </header>

      <div className="counts">
        <span><b className="num">{state.registry.length}</b> registered</span>
        <span className="c-good"><b className="num">{(counts.running || 0) + (counts.starting || 0)}</b> running</span>
        <span><b className="num">{counts.stopped || 0}</b> stopped</span>
        <span className={counts.failed ? 'c-bad' : ''}><b className="num">{counts.failed || 0}</b> failed</span>
        <span><b className="num">{counts.offline || 0}</b> on offline machines</span>
      </div>

      <div className="meters">
        <div className="meter">
          <div className="meter-h">
            <span>CPU</span>
            <b className="num">{on ? Math.round(cpuNow) : '–'}%</b>
          </div>
          <Sparkline data={state.hist.cpu} />
        </div>
        <div className="meter">
          <div className="meter-h">
            <span>GPU load</span>
            <b className="num">{on ? Math.round(gpuNow) : '–'}%</b>
          </div>
          <Sparkline data={state.hist.gpu} className="spark-alt" />
        </div>
        <div className="meter">
          <div className="meter-h">
            <span>RAM</span>
            <b className="num">
              {ram.toFixed(1)} / {m.ramGb} GB
            </b>
          </div>
          <div className="bar">
            <span className="bar-fill bar-accent" style={{ width: (ram / m.ramGb) * 100 + '%' }} />
          </div>
        </div>
      </div>

      <div className="vram">
        <div className="meter-h">
          <span>VRAM by project</span>
          <b className="num">
            {vramUsed.toFixed(1)} / {m.vramGb} GB
          </b>
        </div>
        <div className="vram-bar" role="img" aria-label={`VRAM ${vramUsed.toFixed(1)} of ${m.vramGb} GB`}>
          <span className="vram-seg vram-sys" style={{ width: (0.6 / m.vramGb) * 100 + '%' }} title="Windows + desktop 0.6 GB" />
          {vramUsers.map((p) => (
            <span key={p.id} className="vram-seg" style={{ width: (state.runtime[p.id].vram / m.vramGb) * 100 + '%', '--h': p.hue }} title={`${p.name} ${gb(state.runtime[p.id].vram)}`} />
          ))}
        </div>
        <ul className="legend">
          <li>
            <span className="sw vram-sys" />
            System 0.6 GB
          </li>
          {vramUsers.map((p) => (
            <li key={p.id}>
              <span className="sw" style={{ '--h': p.hue }} />
              {p.name} {gb(state.runtime[p.id].vram)}
            </li>
          ))}
          <li className="muted">Free {(m.vramGb - vramUsed).toFixed(1)} GB</li>
        </ul>
      </div>
    </section>
  )
}

function ProjectRow({ p }) {
  const { state } = useStore()
  const r = state.runtime[p.id]
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  let meta
  if (st === 'running') meta = `Up ${uptime(r.startedAt)}`
  else if (st === 'starting') meta = 'Waiting for health check'
  else if (st === 'failed') meta = `Failed ${ago(r.failedAt)}`
  else if (st === 'offline') meta = MACHINES[p.machine].label
  else if (p.job && r.lastRunAt) meta = `Last run ${ago(r.lastRunAt)}, exit ${r.lastExit}`
  else meta = p.port ? 'Idle' : 'Not running'
  return (
    <li className={'row st-' + st}>
      <a className="row-main" href={'#project-' + p.id}>
        <Glyph p={p} />
        <span className="row-name">
          <b>{p.name}</b>
          <span className="muted small">
            {p.kind}
            {p.port ? `, ${p.udp ? 'UDP' : 'port'} ${p.port}` : ''}
          </span>
        </span>
      </a>
      <span className="row-cat small muted">{CATEGORIES[p.category]}</span>
      <span className="row-plan">
        <PlanChip state={pl.state} />
      </span>
      <span className="row-status">
        <StatusPill status={st} />
        <span className="muted small">{meta}</span>
      </span>
      <span className="row-act">
        <RunControls p={p} compact />
        <a className="btn btn-ghost" href={'#project-' + p.id}>
          Manage
        </a>
      </span>
    </li>
  )
}

export default function Overview({ onAdd }) {
  const { state } = useStore()
  useNow(1000)
  const [cat, setCat] = useState('all')
  const [stf, setStf] = useState('all')
  const [q, setQ] = useState('')

  const list = state.registry.filter((p) => {
    if (cat !== 'all' && p.category !== cat) return false
    const st = statusOf(state, p)
    if (stf === 'running' && !['running', 'starting', 'stopping'].includes(st)) return false
    if (stf === 'stopped' && !['stopped', 'offline'].includes(st)) return false
    if (stf === 'failed' && st !== 'failed') return false
    if (q && !(p.name + ' ' + p.blurb + ' ' + p.kind).toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  const order = { failed: 0, starting: 1, stopping: 1, running: 2, stopped: 3, offline: 4 }
  list.sort((a, b) => order[statusOf(state, a)] - order[statusOf(state, b)])

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Start what you need, stop it when you’re done.</p>
        </div>
        <div className="head-tools">
          <label className="search">
            <Icon name="search" />
            <input id="search" type="search" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Button icon="plus" variant="primary" onClick={onAdd}>
            Add project
          </Button>
        </div>
      </header>

      <div className="over-grid">
        <FocusBand />
        <MachinePanel />
      </div>

      <section className="projects" aria-label="Projects">
        <div className="toolbar">
          <div className="chips" role="tablist" aria-label="Category">
            {[['all', 'All'], ...Object.entries(CATEGORIES)].map(([k, v]) => (
              <button key={k} role="tab" aria-selected={cat === k} className={'chip ' + (cat === k ? 'on' : '')} onClick={() => setCat(k)}>
                {v}
                <span className="chip-n num">{k === 'all' ? state.registry.length : state.registry.filter((p) => p.category === k).length}</span>
              </button>
            ))}
          </div>
          <div className="seg" aria-label="Status">
            {['all', 'running', 'stopped', 'failed'].map((k) => (
              <button key={k} className={stf === k ? 'on' : ''} onClick={() => setStf(k)}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {list.length ? (
          <ul className="rows">
            {list.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>No projects match these filters.</p>
            <button
              className="link"
              onClick={() => {
                setCat('all')
                setStf('all')
                setQ('')
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
