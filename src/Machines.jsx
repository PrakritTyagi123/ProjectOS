import { useState } from 'react'
import { useStore, statusOf } from './store'
import { MACHINES } from './data'
import { Icon, Status, Glyph, Knob, HistoryChart, ago, uptime, useNow } from './ui'
import { SystemPanel } from './Overview'

// Synthetic history so the chart has realistic shape: office hours idle, evenings busy.
function seeded(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const RANGES = { '1h': 3600e3, '24h': 864e5, '7d': 7 * 864e5 }
function history(range) {
  const span = RANGES[range]
  const n = 72
  const rnd = seeded(range.length * 97 + 13)
  const now = Date.now()
  const pts = Array.from({ length: n }, (_, i) => {
    const t = now - span + (i / (n - 1)) * span
    const h = new Date(t).getHours() + new Date(t).getMinutes() / 60
    const evening = h >= 19.5 && h <= 23.5 ? 1 : h >= 10 && h <= 13 && new Date(t).getDay() % 6 === 0 ? 0.8 : 0
    const night = h < 7 ? 1 : 0
    const cpu = 6 + evening * 30 + rnd() * 10 - night * 3
    const gpu = 3 + evening * (35 + rnd() * 25) + rnd() * 6
    const vram = 4 + evening * (40 + rnd() * 10) + rnd() * 3
    return { t, cpu: Math.max(1, cpu), gpu: Math.max(1, gpu), vram: Math.min(98, vram) }
  })
  if (range === '1h') pts.forEach((p, i) => ((p.cpu = 14 + rnd() * 12 + (i > 60 ? 8 : 0)), (p.gpu = 20 + rnd() * 25), (p.vram = 50 + rnd() * 3)))
  return pts
}
const fmtFor = (range) => (t) => {
  const d = new Date(t)
  if (range === '7d') return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function HistoryPanel() {
  const [range, setRange] = useState('24h')
  const data = history(range)
  return (
    <section className="panel">
      <header className="panel-h">
        <div>
          <h2>History</h2>
          <span className="muted small">desktop-01 usage over time. Evenings are your project hours.</span>
        </div>
        <div className="seg has-knob" role="radiogroup" aria-label="Range">
          <Knob />
          {Object.keys(RANGES).map((k) => (
            <button key={k} role="radio" aria-checked={range === k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>
              {k}
            </button>
          ))}
        </div>
      </header>
      <div className="chart-well">
        <HistoryChart
          key={range}
          fmtT={fmtFor(range)}
          series={[
            { name: 'GPU', data: data.map((p) => ({ t: p.t, v: p.gpu })) },
            { name: 'CPU', data: data.map((p) => ({ t: p.t, v: p.cpu })) },
            { name: 'VRAM', data: data.map((p) => ({ t: p.t, v: p.vram })) },
          ]}
        />
      </div>
      <ul className="legend">
        <li><span className="sw hc-k0" />GPU load %</li>
        <li><span className="sw hc-k1" />CPU %</li>
        <li><span className="sw hc-k2" />VRAM used %</li>
      </ul>
    </section>
  )
}

export default function Machines() {
  const { state, engine } = useStore()
  useNow(5000)
  const desk = state.machines['desktop-01']
  const hosted = (id) => state.registry.filter((p) => p.machine === id)
  const m = MACHINES['desktop-01']
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Machines</h1>
          <p className="muted small">Each PC runs its own agent with its own identity. Nothing on a machine is reachable without one.</p>
        </div>
      </header>
      <SystemPanel big />
      <HistoryPanel />
      <div className="grid-2">
        <section className="panel device">
          <header className="panel-h">
            <h2>desktop-01</h2>
            <Status status={desk ? 'running' : 'offline'} label={desk ? 'Online' : 'Offline'} />
          </header>
          <dl className="kvs">
            <div className="kv"><dt>Role</dt><dd>Home PC, all personal backends</dd></div>
            <div className="kv"><dt>System</dt><dd>{m.os}, {m.cpu}, {m.ramGb} GB RAM</dd></div>
            <div className="kv"><dt>GPU</dt><dd>{m.gpu}, {m.vramGb} GB</dd></div>
            <div className="kv"><dt>Agent</dt><dd>{m.agent}, Task Scheduler at logon, up {uptime(state.runtime.projectos.startedAt)}</dd></div>
            <div className="kv"><dt>Tunnel</dt><dd><code>{m.tunnel}</code> via cloudflared service</dd></div>
            <div className="kv"><dt>Last seen</dt><dd>{desk ? 'Now' : ago(state.lastSeen)}</dd></div>
            <div className="kv"><dt>Wake-on-LAN</dt><dd className="muted">Not set up</dd></div>
          </dl>
          <div className="row-btns">
            <button className={'pwr ' + (desk ? 'pwr-on' : '')} onClick={() => engine.setMachine('desktop-01', !desk)} aria-label={desk ? 'Simulate sleep' : 'Simulate wake'} title={desk ? 'Simulate sleep' : 'Simulate wake'}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
            </button>
            <span className="small muted">{desk ? 'Simulate sleep' : 'Simulate wake'}</span>
            <button className="btn btn-sm" disabled title="Needs Wake-on-LAN and a device on the LAN">
              Wake
            </button>
          </div>
        </section>
        <section className="panel device device-off">
          <header className="panel-h">
            <h2>office-ws</h2>
            <Status status="offline" label="Not linked" />
          </header>
          <dl className="kvs">
            <div className="kv"><dt>Role</dt><dd>Office workstation</dd></div>
            <div className="kv"><dt>Agent</dt><dd className="muted">Not installed</dd></div>
            <div className="kv"><dt>Why</dt><dd>{MACHINES['office-ws'].note}</dd></div>
          </dl>
          <div className="inset-note">
            <span className="label">Before linking</span>
            <p>Get written approval from C-DAC network security. Until then ForeQuAST stays listed here for planning only.</p>
          </div>
        </section>
      </div>
      <section className="panel flat-panel">
        <header className="panel-h"><h2>Projects by machine</h2></header>
        <div className="grid-2">
          {['desktop-01', 'office-ws'].map((id) => (
            <div key={id}>
              <h3 className="sub-h">{id}</h3>
              <ul className="plain-list">
                {hosted(id).map((p) => (
                  <li key={p.id}>
                    <a href={'#project-' + p.id} className="cell-name">
                      <Glyph p={p} size={22} />
                      <span>{p.name}</span>
                    </a>
                    <Status status={statusOf(state, p)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
