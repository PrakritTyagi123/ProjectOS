import { useStore, statusOf } from './store'
import { MACHINES, PLAN_STATES } from './data'
import { Icon, Glyph, Sparkline, Status, Num, Led, Gauge, uptime, ago, useNow, gb } from './ui'
import { Actions, go } from './App'
import { useWeek, todayIdx, sessionStart } from './week'

const LIVE = ['running', 'starting', 'stopping']

function Well({ label, value, unit, sub, children }) {
  return (
    <div className="well">
      <div className="well-h">
        <span>{label}</span>
        {sub && <span className="well-sub num">{sub}</span>}
      </div>
      <div className="well-v num">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {children}
    </div>
  )
}

export function SystemPanel({ big }) {
  const { state } = useStore()
  const m = MACHINES['desktop-01']
  const on = state.machines['desktop-01']
  const procs = state.registry.filter((p) => p.machine === 'desktop-01' && state.runtime[p.id].status === 'running')
  const ram = on ? 7.2 + procs.reduce((a, p) => a + state.runtime[p.id].ram, 0) : 0
  const users = procs.filter((p) => state.runtime[p.id].vram > 0).sort((a, b) => state.runtime[b.id].vram - state.runtime[a.id].vram)
  const vram = on ? 0.6 + users.reduce((a, p) => a + state.runtime[p.id].vram, 0) : 0
  const cpu = on ? state.hist.cpu[state.hist.cpu.length - 1] : 0
  const gpu = on ? state.hist.gpu[state.hist.gpu.length - 1] : 0
  return (
    <section className={'panel sys ' + (on ? '' : 'is-off')} aria-label="System">
      <header className="panel-h">
        <div>
          <h2>desktop-01</h2>
          <span className="muted small">
            {m.os}, {m.gpu} {m.vramGb} GB, {m.ramGb} GB RAM
          </span>
        </div>
        <div className="conn">
          <Status status={on ? 'running' : 'offline'} label={on ? 'Agent online' : 'Agent offline'} />
          <Status status={on ? 'running' : 'offline'} label={on ? 'Tunnel connected' : 'Tunnel down'} />
          <Status status="running" label="Access on" />
        </div>
      </header>
      <div className="dials">
        <Gauge value={cpu} label="CPU" />
        <Gauge value={gpu} label="GPU load" />
        <Gauge value={ram} max={m.ramGb} unit="G" label="Memory" />
        <Gauge value={vram} max={m.vramGb} unit="G" label="VRAM" color={vram / m.vramGb > 0.85 ? 'var(--busy)' : 'var(--accent)'} />
      </div>
      <div className="hist-wells">
        <div className="well">
          <div className="well-h"><span>CPU, last minute</span><span className="num">{Math.round(cpu)}%</span></div>
          <Sparkline data={on ? state.hist.cpu : state.hist.cpu.map(() => 0)} height={big ? 50 : 34} />
        </div>
        <div className="well">
          <div className="well-h"><span>GPU, last minute</span><span className="num">{Math.round(gpu)}%</span></div>
          <Sparkline data={on ? state.hist.gpu : state.hist.gpu.map(() => 0)} height={big ? 50 : 34} />
        </div>
      </div>
      <div className="alloc">
        <div className="alloc-h small">
          <span>VRAM by process</span>
          <span className="muted num">{(m.vramGb - vram).toFixed(1)} GB free</span>
        </div>
        <div className="vram-strip">
          {on && <span className="vs-seg vs-sys" style={{ width: (0.6 / m.vramGb) * 100 + '%' }} title="Windows 0.6 GB" />}
          {on &&
            users.map((p, i) => (
              <span key={p.id} className={'vs-seg vs-' + (i % 4)} style={{ width: (state.runtime[p.id].vram / m.vramGb) * 100 + '%' }} title={`${p.name} ${gb(state.runtime[p.id].vram)}`}>
                {p.name} {state.runtime[p.id].vram.toFixed(1)}
              </span>
            ))}
        </div>
      </div>
    </section>
  )
}

function FocusPanel() {
  const { state } = useStore()
  const p = state.registry.find((x) => state.plan[x.id]?.state === 'active')
  if (!p)
    return (
      <section className="panel focus focus-empty">
        <h2>Current focus</h2>
        <p className="muted">No active project. Pick one queued project and give it a small, finishable milestone.</p>
        <a className="btn btn-primary btn-sm" href="#focus">
          Choose on the focus board
        </a>
      </section>
    )
  const pl = state.plan[p.id]
  const done = pl.dod.filter((d) => d.d).length
  return (
    <section className="panel focus" aria-label="Current focus">
      <header className="panel-h">
        <h2>Current focus</h2>
        {pl.sprint && (
          <span className="muted small num">
            Day {pl.sprint.day} of {pl.sprint.of}
          </span>
        )}
      </header>
      <div className="focus-id">
        <Glyph p={p} size={36} />
        <div>
          <a href={'#project-' + p.id} className="focus-name">
            {p.name.replace(' Agent', '')}
          </a>
          <div className="muted small">{pl.milestone}</div>
        </div>
      </div>
      <div className="focus-prog">
        <div className="dod-seg" aria-label={`${done} of ${pl.dod.length} done`}>
          {pl.dod.map((d, i) => (
            <span key={i} className={d.d ? 'on' : ''} title={d.t} style={{ '--i': i }} />
          ))}
        </div>
        <span className="small num">
          {done}/{pl.dod.length} done
        </span>
      </div>
      <div className="inset-note">
        <span className="label">Next action</span>
        <p>{pl.next}</p>
      </div>
      {pl.blocker && (
        <div className="focus-block small">
          <Icon name="warn" size={14} />
          <span>{pl.blocker}</span>
        </div>
      )}
      <div className="row-btns">
        <a className="btn btn-sm" href={'#project-' + p.id}>
          Open workspace
        </a>
        <a className="btn btn-sm" href="#focus">
          Focus board
        </a>
      </div>
    </section>
  )
}

function RunningPanel() {
  const { state } = useStore()
  useNow(1000)
  const live = state.registry.filter((p) => LIVE.includes(statusOf(state, p)))
  return (
    <section className="panel flat-panel" aria-label="Running services">
      <header className="panel-h">
        <h2>Running services</h2>
        <a href="#runtime" className="small">
          Runtime
        </a>
      </header>
      {live.length ? (
        <div className="table-wrap">
          <table className="dense">
            <thead>
              <tr>
                <th>Service</th>
                <th className="r">Port</th>
                <th className="r">Uptime</th>
                <th className="r">CPU</th>
                <th className="r">VRAM</th>
                <th className="r">Health</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {live.map((p) => {
                const r = state.runtime[p.id]
                const st = statusOf(state, p)
                return (
                  <tr key={p.id} onClick={() => go('project-' + p.id)}>
                    <td>
                      <span className="cell-name">
                        <Led status={st} />
                        <b>{p.name}</b>
                      </span>
                    </td>
                    <td className="r num muted">{p.port || '–'}</td>
                    <td className="r num">{st === 'running' ? uptime(r.startedAt) : st === 'starting' ? 'starting' : 'stopping'}</td>
                    <td className="r num">{st === 'running' ? r.cpu.toFixed(0) + '%' : '–'}</td>
                    <td className="r num">{st === 'running' && p.gpu ? r.vram.toFixed(1) + ' GB' : '–'}</td>
                    <td className="r num">{st === 'running' ? (p.health ? `${r.health?.ms ?? '–'} ms` : 'alive') : '–'}</td>
                    <td className="r">
                      <Actions p={p} more={false} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted empty-line">Nothing running. Backends start on demand from Projects.</p>
      )}
    </section>
  )
}

function AttentionPanel() {
  const { state } = useStore()
  const [week] = useWeek()
  const items = []
  state.registry.forEach((p) => {
    const st = statusOf(state, p)
    const r = state.runtime[p.id]
    if (st === 'failed') items.push({ tone: 'bad', p, text: `${p.name} failed to start`, sub: `Exit code ${r.lastExit}, ${ago(r.failedAt)}`, action: ['View error', () => go('project-' + p.id)] })
  })
  const off = state.registry.filter((p) => statusOf(state, p) === 'offline')
  if (off.length) items.push({ tone: 'off', text: `${off.length} project${off.length > 1 ? 's' : ''} on an unlinked machine`, sub: off.map((p) => p.name).join(', '), action: ['Machines', () => go('machines')] })
  state.registry.forEach((p) => {
    const pl = state.plan[p.id]
    if (pl.blocker && ['active', 'committed'].includes(pl.state)) items.push({ tone: 'warn', p, text: `${p.name} is blocked`, sub: pl.blocker, action: ['Plan', () => go('project-' + p.id)] })
  })
  const vram = 0.6 + state.registry.filter((p) => state.runtime[p.id].status === 'running').reduce((a, p) => a + state.runtime[p.id].vram, 0)
  if (vram / 16 > 0.85) items.push({ tone: 'warn', text: 'VRAM above 85%', sub: `${vram.toFixed(1)} of 16 GB in use`, action: ['Runtime', () => go('runtime')] })
  const planned = week.reduce((a, d) => a + (d.rest ? 0 : d.plan), 0)
  if (planned > 10) items.push({ tone: 'warn', text: 'Week is over capacity', sub: `${planned} h planned, 10 h is the limit`, action: ['Adjust', () => go('focus')] })
  if (!week.some((d) => d.rest)) items.push({ tone: 'warn', text: 'No rest evening this week', sub: 'Keep at least one evening free', action: ['Adjust', () => go('focus')] })
  return (
    <section className="panel" aria-label="Needs attention">
      <header className="panel-h">
        <h2>Needs attention</h2>
        <span className="count-chip num">{items.length}</span>
      </header>
      {items.length ? (
        <ul className="attn">
          {items.map((it, i) => (
            <li key={i} className={'attn-' + it.tone}>
              <span className="attn-dot" />
              <div>
                <b>{it.text}</b>
                <span className="small muted">{it.sub}</span>
              </div>
              <button className="btn btn-sm" onClick={it.action[1]}>
                {it.action[0]}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted empty-line">Nothing needs attention.</p>
      )}
    </section>
  )
}

const D0 = 6
const D1 = 24
const pos = (h) => ((Math.min(D1, Math.max(D0, h)) - D0) / (D1 - D0)) * 100
const fmtH = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const span = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

function TodayPanel() {
  const [week] = useWeek()
  useNow(30000)
  const i = todayIdx()
  const day = week[i]
  const d = new Date()
  const now = d.getHours() + d.getMinutes() / 60
  const weekend = i >= 5
  const s0 = sessionStart(i)
  const s1 = s0 + day.plan
  let msg
  if (!weekend && now >= 9 && now < 17.5) msg = `Office until 17:30. Personal time in ${span(Math.round((17.5 - now) * 60))}.`
  else if (day.rest || !day.plan) msg = 'Rest evening. No project work planned.'
  else if (now < s0) msg = `Session at ${fmtH(s0)} for ${day.plan} h.`
  else if (now < s1) msg = `Session until ${fmtH(s1)}.`
  else msg = 'Done for today. Write the handoff note.'
  const planned = week.reduce((a, x) => a + (x.rest ? 0 : x.plan), 0)
  const done = week.reduce((a, x) => a + x.done, 0)
  return (
    <section className="panel today" aria-label="Today">
      <header className="panel-h">
        <h2>Today</h2>
        <span className="muted small">{d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      </header>
      <p className="small">{msg}</p>
      <div className="ds-track">
        {!weekend && <span className="ds-block ds-office" style={{ left: pos(9) + '%', width: pos(17.5) - pos(9) + '%' }}>Office</span>}
        {day.plan > 0 && !day.rest && <span className="ds-block ds-session" style={{ left: pos(s0) + '%', width: pos(s1) - pos(s0) + '%' }} title={`${fmtH(s0)} to ${fmtH(s1)}`} />}
        <span className="ds-now" style={{ left: pos(now) + '%' }} title={fmtH(now)} />
      </div>
      <div className="ds-scale">
        {[6, 12, 18, 24].map((m) => (
          <span key={m} style={{ left: pos(m) + '%' }} className="num">
            {String(m % 24).padStart(2, '0')}
          </span>
        ))}
      </div>
      <div className="week-mini" aria-label={`${done} of ${planned} hours this week`}>
        {week.map((x, j) => (
          <div key={x.d} className={'wm ' + (j === i ? 'wm-today' : '') + (x.rest ? ' wm-rest' : '')} title={`${x.d}: ${x.rest ? 'rest' : `${x.done} of ${x.plan} h`}`}>
            <div className="wm-bar">
              <i style={{ height: (Math.min(x.plan, 4) / 4) * 100 + '%' }} />
              <b style={{ height: (Math.min(x.done, 4) / 4) * 100 + '%' }} />
            </div>
            <span>{x.d[0]}</span>
          </div>
        ))}
        <div className="wm-total">
          <b className="num">{done.toFixed(1)}</b>
          <span className="muted small num">of {planned} h</span>
        </div>
      </div>
    </section>
  )
}

function RecentPanel() {
  const { state } = useStore()
  useNow(10000)
  const seen = new Set()
  const recent = []
  for (const a of state.activity) {
    if (a.project && !seen.has(a.project)) {
      seen.add(a.project)
      const p = state.registry.find((x) => x.id === a.project)
      if (p && !p.self) recent.push({ p, a })
    }
    if (recent.length >= 5) break
  }
  return (
    <section className="panel flat-panel" aria-label="Recent projects">
      <header className="panel-h">
        <h2>Recent projects</h2>
        <a href="#projects" className="small">
          All {state.registry.length} projects
        </a>
      </header>
      <ul className="recent">
        {recent.map(({ p, a }) => {
          const st = statusOf(state, p)
          return (
            <li key={p.id} onClick={() => go('project-' + p.id)}>
              <Glyph p={p} size={28} />
              <div className="recent-name">
                <b>{p.name}</b>
                <span className="small muted">
                  {a.action} {ago(a.t)}
                </span>
              </div>
              <span className="prio small">{PLAN_STATES[state.plan[p.id].state].label}</span>
              <Status status={st} />
              <Actions p={p} open={false} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Overview() {
  return (
    <div className="page ov">
      <SystemPanel />
      <FocusPanel />
      <RunningPanel />
      <AttentionPanel />
      <RecentPanel />
      <TodayPanel />
    </div>
  )
}
