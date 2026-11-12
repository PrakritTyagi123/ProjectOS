import { useStore, statusOf } from './store'
import { MACHINES } from './data'
import { Icon, Status, Glyph, ago, uptime, useNow } from './ui'
import { SystemPanel } from './Overview'

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
      <div className="grid-2">
        <section className="panel">
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
            <button className="btn btn-sm" onClick={() => engine.setMachine('desktop-01', !desk)}>
              <Icon name={desk ? 'moon' : 'sun'} />
              <span>{desk ? 'Simulate sleep' : 'Simulate wake'}</span>
            </button>
            <button className="btn btn-sm" disabled title="Needs Wake-on-LAN and a device on the LAN">
              Wake
            </button>
          </div>
        </section>
        <section className="panel">
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
