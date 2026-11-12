import { useStore, statusOf } from './store'
import { MACHINES } from './data'
import { Icon, Glyph, Status, LiveBars, uptime, useNow, gb } from './ui'
import { Actions, go } from './App'
import { SystemPanel } from './Overview'

export default function Runtime() {
  const { state, engine } = useStore()
  useNow(1000)
  const reg = state.registry
  const ports = reg.filter((p) => p.port).map((p) => ({ p, port: p.port, proto: p.udp ? 'UDP' : 'TCP', st: statusOf(state, p) }))
  const dupes = ports.filter((x, i) => ports.findIndex((y) => y.port === x.port) !== i).map((x) => x.port)
  const gpuProjects = reg.filter((p) => p.gpu && p.machine === 'desktop-01')
  const used = 0.6 + reg.filter((p) => state.runtime[p.id].status === 'running').reduce((a, p) => a + state.runtime[p.id].vram, 0)
  const free = 16 - used
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Runtime</h1>
          <p className="muted small">Every process the agent supervises, the ports they use, and whether the GPU can take another model.</p>
        </div>
      </header>

      <SystemPanel big />

      <section className="panel flat-panel">
        <header className="panel-h">
          <h2>Process supervisor</h2>
          <span className="muted small">Graceful stop, 10 s timeout, then the Job Object is closed</span>
        </header>
        <div className="table-wrap">
          <table className="dense">
            <thead>
              <tr>
                <th>Service</th>
                <th>Process</th>
                <th className="r">PID</th>
                <th className="r">Uptime</th>
                <th className="r">CPU</th>
                <th className="r">RAM</th>
                <th className="r">VRAM</th>
                <th>Restart</th>
                <th className="c-spark">Load</th>
                <th className="r" />
              </tr>
            </thead>
            <tbody>
              {reg.map((p) => {
                const r = state.runtime[p.id]
                const st = statusOf(state, p)
                const on = st === 'running'
                return (
                  <tr key={p.id} onClick={() => go('project-' + p.id)}>
                    <td>
                      <span className="cell-name">
                        <Glyph p={p} size={22} />
                        <b>{p.name}</b>
                      </span>
                    </td>
                    <td>
                      <Status status={st} />
                    </td>
                    <td className="r num muted">{on || st === 'starting' ? r.pid : '–'}</td>
                    <td className="r num">{on ? uptime(r.startedAt) : '–'}</td>
                    <td className="r num">{on ? r.cpu.toFixed(0) + '%' : '–'}</td>
                    <td className="r num">{on ? gb(r.ram) : '–'}</td>
                    <td className="r num">{on && p.gpu ? gb(r.vram) : '–'}</td>
                    <td className="small muted">{p.restart.split(' ')[0]}</td>
                    <td className="c-spark">
                      <LiveBars data={r.hist.slice(-16)} color="var(--accent)" />
                    </td>
                    <td className="r">
                      <Actions p={p} open={false} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel flat-panel">
          <header className="panel-h">
            <h2>Ports</h2>
            <span className={'small ' + (dupes.length ? 'c-bad' : 'muted')}>{dupes.length ? `Conflict on ${dupes.join(', ')}` : 'No conflicts'}</span>
          </header>
          <div className="table-wrap">
          <table className="dense">
            <thead>
              <tr>
                <th className="r">Port</th>
                <th>Proto</th>
                <th>Owner</th>
                <th>State</th>
                <th>Reachable from</th>
              </tr>
            </thead>
            <tbody>
              {ports
                .sort((a, b) => a.port - b.port)
                .map(({ p, port, proto, st }) => (
                  <tr key={p.id} onClick={() => go('project-' + p.id)}>
                    <td className="r num">
                      <b>{port}</b>
                    </td>
                    <td className="small muted">{proto}</td>
                    <td>{p.name}</td>
                    <td>
                      <Status status={st === 'running' ? 'running' : st === 'offline' ? 'offline' : 'stopped'} label={st === 'running' ? 'Listening' : st === 'offline' ? 'Other machine' : 'Free'} />
                    </td>
                    <td className="small muted">{p.udp ? 'LAN only (UDP)' : p.frontend ? p.frontend.replace('https://', '') + ' via tunnel' : '127.0.0.1 only'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="panel">
          <header className="panel-h">
            <h2>GPU manager</h2>
            <span className="muted small num">{free.toFixed(1)} GB free of 16</span>
          </header>
          <p className="small muted">Can each GPU project start right now without stopping something?</p>
          <ul className="gpu-check">
            {gpuProjects.map((p) => {
              const st = statusOf(state, p)
              const c = engine.vramConflict(p.id)
              const verdict = st === 'running' ? ['running', 'Running', `${gb(state.runtime[p.id].vram)}`] : c ? ['failed', 'Needs room', `Stop ${c.holders.map((h) => h.name).join(', ')}`] : ['ok', 'Fits', `${p.profile.vram} GB needed`]
              return (
                <li key={p.id}>
                  <span className="cell-name">
                    <Glyph p={p} size={22} />
                    <b>{p.name}</b>
                  </span>
                  <span className={'fit fit-' + verdict[0]}>{verdict[1]}</span>
                  <span className="small muted num">{verdict[2]}</span>
                  <div className="fit-bar">
                    <i style={{ width: (p.profile.vram / 16) * 100 + '%' }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <section className="panel">
        <header className="panel-h">
          <h2>Dependencies</h2>
          <span className="muted small">Started in this order, each waits for the one before to be healthy</span>
        </header>
        <ul className="deps">
          {reg
            .filter((p) => p.deps.length)
            .map((p) => (
              <li key={p.id}>
                {p.deps.map((d) => (
                  <span key={d} className="dep">
                    {d}
                  </span>
                ))}
                <Icon name="chev" size={12} />
                <a href={'#project-' + p.id} className="dep dep-main">
                  {p.name}
                </a>
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}
