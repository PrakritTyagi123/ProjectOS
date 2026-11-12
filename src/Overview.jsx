import { useState } from 'react'
import { useStore, statusOf } from './store'
import { CATEGORIES, MACHINES } from './data'
import { Icon, Glyph, PlanChip, Gauge, Ring, LiveBars, Led, STATUS, Button, uptime, ago, useNow, gb, catVar } from './ui'
import { Power } from './App'

function ActiveCard() {
  const { state } = useStore()
  const p = state.registry.find((x) => state.plan[x.id]?.state === 'active')
  if (!p)
    return (
      <section className="hud-card active-card active-empty">
        <h2>No active project</h2>
        <p>Promote one queued project and give it a small milestone.</p>
        <a className="btn btn-primary" href="#plan">Open the plan</a>
      </section>
    )
  const pl = state.plan[p.id]
  const done = pl.dod.filter((d) => d.d).length
  return (
    <section className="hud-card active-card" aria-label="Active project">
      <div className="ac-top">
        <span className="ac-tag">Active project</span>
        {pl.sprint && (
          <span className="sprint" aria-label={`Sprint day ${pl.sprint.day} of ${pl.sprint.of}`}>
            {Array.from({ length: pl.sprint.of }, (_, i) => (
              <i key={i} className={i < pl.sprint.day - 1 ? 'past' : i === pl.sprint.day - 1 ? 'today' : ''} />
            ))}
            <em className="num">
              Day {pl.sprint.day}/{pl.sprint.of}
            </em>
          </span>
        )}
      </div>
      <div className="ac-body">
        <Ring done={done} total={pl.dod.length} />
        <div className="ac-text">
          <h2>
            <a href={'#project-' + p.id}>{p.name.replace(' Agent', '')}</a>
          </h2>
          <div className="ac-ms">{pl.milestone}</div>
          <div className="dod-seg" role="list" aria-label="Definition of done">
            {pl.dod.map((d, i) => (
              <span key={i} role="listitem" className={d.d ? 'on' : ''} title={(d.d ? 'Done: ' : 'To do: ') + d.t} style={{ '--i': i }} />
            ))}
          </div>
        </div>
      </div>
      <div className="ac-next">
        <span className="ac-label">Next action</span>
        <p>{pl.next}</p>
      </div>
      {pl.blocker && (
        <div className="ac-block">
          <Icon name="warn" size={14} />
          <span>{pl.blocker}</span>
        </div>
      )}
      {pl.sessions[0] && (
        <div className="ac-last">
          <span>Last session</span>
          <b className="num">{pl.sessions[0].mins} min</b>
          <span>{pl.sessions[0].note}</span>
        </div>
      )}
    </section>
  )
}

function MachineCard() {
  const { state } = useStore()
  const m = MACHINES['desktop-01']
  const on = state.machines['desktop-01']
  const procs = state.registry.filter((p) => p.machine === 'desktop-01' && state.runtime[p.id].status === 'running')
  const ram = on ? 7.2 + procs.reduce((a, p) => a + state.runtime[p.id].ram, 0) : 0
  const vramUsers = procs.filter((p) => state.runtime[p.id].vram > 0)
  const vram = on ? 0.6 + vramUsers.reduce((a, p) => a + state.runtime[p.id].vram, 0) : 0
  const cpu = on ? state.hist.cpu[state.hist.cpu.length - 1] : 0
  const gpu = on ? state.hist.gpu[state.hist.gpu.length - 1] : 0
  return (
    <section className={'hud-card machine ' + (on ? '' : 'is-off')} aria-label="Machine">
      <div className="hud-h">
        <h3>desktop-01</h3>
        <span className="muted small">
          {m.gpu} {m.vramGb} GB, {m.ramGb} GB RAM
        </span>
      </div>
      <div className="gauges">
        <Gauge value={cpu} label="CPU" color="var(--c-web)" />
        <Gauge value={gpu} label="GPU load" color="var(--c-ai)" />
        <Gauge value={ram} max={m.ramGb} unit="G" label="RAM" color="var(--c-tools)" />
        <Gauge value={vram} max={m.vramGb} unit="G" label="VRAM" color="var(--c-games)" />
      </div>
      <div className="vram-strip" role="img" aria-label={`VRAM ${vram.toFixed(1)} of ${m.vramGb} GB`}>
        {on && <span className="vs-seg vs-sys" style={{ width: (0.6 / m.vramGb) * 100 + '%' }} title="System 0.6 GB" />}
        {on &&
          vramUsers.map((p) => (
            <span key={p.id} className="vs-seg" style={{ width: (state.runtime[p.id].vram / m.vramGb) * 100 + '%', '--h': p.hue }} title={`${p.name} ${gb(state.runtime[p.id].vram)}`}>
              {p.name}
            </span>
          ))}
      </div>
      <ul className="legend">
        {on && vramUsers.map((p) => (
          <li key={p.id}>
            <span className="sw" style={{ background: `hsl(${p.hue} 40% 62%)` }} />
            {p.name} {gb(state.runtime[p.id].vram)}
          </li>
        ))}
        <li>Free {(m.vramGb - vram).toFixed(1)} GB</li>
      </ul>
      <div className="hist">
        <div className="hist-row">
          <span className="small muted">CPU, last minute</span>
          <LiveBars data={on ? state.hist.cpu.slice(-36) : Array(36).fill(0)} color="var(--c-web)" />
        </div>
        <div className="hist-row">
          <span className="small muted">GPU, last minute</span>
          <LiveBars data={on ? state.hist.gpu.slice(-36) : Array(36).fill(0)} color="var(--c-ai)" />
        </div>
      </div>
    </section>
  )
}

function LiveCard() {
  const { state } = useStore()
  const live = state.registry.filter((p) => ['running', 'starting', 'stopping'].includes(statusOf(state, p)))
  const counts = state.registry.reduce((a, p) => ((a[statusOf(state, p)] = (a[statusOf(state, p)] || 0) + 1), a), {})
  const n = state.registry.length
  const quick = state.registry
    .filter((p) => ['active', 'committed', 'queued'].includes(state.plan[p.id].state) && ['stopped', 'failed'].includes(statusOf(state, p)) && !p.self)
    .slice(0, 3)
  const segs = [
    ['running', counts.running || 0],
    ['starting', (counts.starting || 0) + (counts.stopping || 0)],
    ['failed', counts.failed || 0],
    ['stopped', counts.stopped || 0],
    ['offline', counts.offline || 0],
  ]
  return (
    <section className="hud-card live" aria-label="Running now">
      <div className="hud-h">
        <h3>Running now</h3>
        <span className="num muted small">
          {live.length} of {n}
        </span>
      </div>
      <div className="mix" aria-hidden="true">
        {segs.map(([k, v]) => v > 0 && <span key={k} className={'mix-' + STATUS[k].tone} style={{ flex: v }} />)}
      </div>
      <div className="mix-legend small">
        {segs.map(([k, v]) => v > 0 && (
          <span key={k}>
            <Led status={k} /> <b className="num">{v}</b> {k === 'starting' ? 'changing' : STATUS[k].label.toLowerCase()}
          </span>
        ))}
      </div>
      <ul className="live-list">
        {live.map((p) => {
          const r = state.runtime[p.id]
          return (
            <li key={p.id} style={{ '--c': catVar(p.category) }}>
              <a href={'#project-' + p.id}>
                <Led status={statusOf(state, p)} />
                <span className="ll-name">{p.name}</span>
                <LiveBars data={r.hist.slice(-12)} color={catVar(p.category)} />
                <span className="num small muted">{r.status === 'running' ? uptime(r.startedAt) : '…'}</span>
              </a>
            </li>
          )
        })}
        {live.length === 0 && <li className="muted small">Nothing running. Backends start on demand.</li>}
      </ul>
      {quick.length > 0 && (
        <>
          <div className="hud-h quick-h">
            <h3>Quick start</h3>
            <span className="muted small">Active, committed and queued</span>
          </div>
          <ul className="quick">
            {quick.map((p) => (
              <li key={p.id} style={{ '--c': catVar(p.category) }}>
                <Power p={p} />
                <a href={'#project-' + p.id}>{p.name}</a>
                <span className="small muted">{statusOf(state, p) === 'failed' ? 'failed last time' : p.kind}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Module({ p, i }) {
  const { state } = useStore()
  const r = state.runtime[p.id]
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  const last = r.logs[r.logs.length - 1]
  const lastErr = [...r.logs].reverse().find((l) => l.stream === 'err')
  let line
  if (st === 'starting') line = <span className="mod-line busy">{last?.text}</span>
  else if (st === 'failed') line = <span className="mod-line bad">{lastErr?.text || r.error}</span>
  else if (st === 'offline') line = <span className="mod-line">{MACHINES[p.machine].label} not linked</span>
  else if (st === 'running') line = <span className="mod-line">{last?.text}</span>
  else if (p.job && r.lastRunAt) line = <span className="mod-line">Last run {ago(r.lastRunAt)}, exit {r.lastExit}</span>
  else line = <span className="mod-line">{p.blurb}</span>

  return (
    <li className={'mod mod-' + st} style={{ '--c': catVar(p.category), '--i': i }}>
      <div className="mod-head">
        <Glyph p={p} size={38} />
        <a className="mod-name" href={'#project-' + p.id}>
          <b>{p.name}</b>
          <span>
            {p.kind}
            {p.port ? `, ${p.udp ? 'UDP' : 'port'} ${p.port}` : ''}
          </span>
        </a>
        <Power p={p} />
      </div>
      <div className="mod-viz">
        <LiveBars data={r.hist} color={catVar(p.category)} />
        {st === 'starting' && <span className="scan" />}
      </div>
      {line}
      <div className="mod-foot">
        <span className={'st st-' + STATUS[st].tone}>
          <Led status={st} />
          {STATUS[st].label}
        </span>
        <span className="mod-stats num">
          {st === 'running' ? (
            <>
              <span>{uptime(r.startedAt)}</span>
              <span>{r.cpu.toFixed(0)}% cpu</span>
              {p.gpu && <span>{r.vram.toFixed(1)}G vram</span>}
            </>
          ) : (
            <span className="muted">{CATEGORIES[p.category]}</span>
          )}
        </span>
        <a className="mod-doc" href={'#readme-' + p.id} title={`${p.name} README`} aria-label={`${p.name} README`}>
          <Icon name="doc" size={14} />
        </a>
        <PlanChip state={pl.state} />
      </div>
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
      <div className="hud">
        <ActiveCard />
        <MachineCard />
        <LiveCard />
      </div>

      <section className="projects" aria-label="Projects">
        <div className="toolbar">
          <div className="chips" role="tablist" aria-label="Category">
            {[['all', 'All'], ...Object.entries(CATEGORIES)].map(([k, v]) => (
              <button key={k} role="tab" aria-selected={cat === k} className={'chip ' + (cat === k ? 'on' : '')} style={{ '--c': k === 'all' ? 'var(--ink)' : catVar(k) }} onClick={() => setCat(k)}>
                {k !== 'all' && <i className="chip-dot" />}
                {v}
                <span className="chip-n num">{k === 'all' ? state.registry.length : state.registry.filter((p) => p.category === k).length}</span>
              </button>
            ))}
          </div>
          <div className="tools-r">
            <div className="seg" aria-label="Status filter">
              {['all', 'running', 'stopped', 'failed'].map((k) => (
                <button key={k} className={stf === k ? 'on' : ''} onClick={() => setStf(k)}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
            <label className="search">
              <Icon name="search" />
              <input id="search" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </div>
        {list.length ? (
          <ul className="mods">
            {list.map((p, i) => (
              <Module key={p.id} p={p} i={i} />
            ))}
            <li className="mod mod-add" style={{ '--i': list.length }}>
              <button onClick={onAdd}>
                <Icon name="plus" size={20} />
                <b>Register a project</b>
                <span>Point the agent at an existing folder. No code changes.</span>
              </button>
            </li>
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
