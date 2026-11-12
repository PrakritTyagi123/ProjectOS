import { useStore, statusOf } from './store'
import { Icon, Status, Glyph, ago, useNow } from './ui'

const DEP = { live: ['running', 'Live'], building: ['starting', 'Building'], failed: ['failed', 'Failed'] }

export default function Deploy() {
  const { state, engine } = useStore()
  useNow(5000)
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Deployments</h1>
          <p className="muted small">Frontends on Cloudflare Pages, and whether the backend behind each one is reachable through the tunnel right now.</p>
        </div>
      </header>
      <section className="panel flat-panel">
        <div className="table-wrap">
          <table className="dense">
            <thead>
              <tr>
                <th>Frontend</th>
                <th>Pages project</th>
                <th>Build</th>
                <th>Commit</th>
                <th>Access</th>
                <th>Backend</th>
                <th className="r" />
              </tr>
            </thead>
            <tbody>
              {state.deploys.filter((d) => state.registry.some((x) => x.id === d.id)).map((d) => {
                const p = state.registry.find((x) => x.id === d.id)
                const st = statusOf(state, p)
                const [ds, dl] = DEP[d.status]
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="cell-name">
                        <Glyph p={p} size={22} />
                        <span className="cell-stack">
                          <a href={'https://' + d.host} target="_blank" rel="noopener noreferrer">{d.host}</a>
                          <span className="small muted">{p.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="small"><code>{d.pages}</code> <span className="muted">{d.branch}</span></td>
                    <td>
                      <Status status={ds} label={dl} sub={d.status === 'building' ? null : ago(d.at)} />
                      {d.note && <div className="small c-bad">{d.note}</div>}
                    </td>
                    <td><code className="small">{d.commit}</code></td>
                    <td>
                      <Status status={d.access ? 'running' : 'failed'} label={d.access ? 'Protected' : 'Public'} />
                    </td>
                    <td>
                      <Status status={st === 'running' ? 'running' : st === 'offline' ? 'offline' : 'stopped'} label={st === 'running' ? 'Reachable' : st === 'offline' ? 'Machine offline' : 'Backend offline page'} />
                    </td>
                    <td className="r">
                      <div className="actions">
                        <button className="btn btn-sm" disabled={d.status === 'building'} onClick={() => engine.redeploy(d.id)}>
                          <Icon name="restart" />
                          <span>Redeploy</span>
                        </button>
                        <a className="btn btn-sm" href={'https://' + d.host} target="_blank" rel="noopener noreferrer">
                          <Icon name="open" />
                          <span>Open</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="banner">
        <Icon name="warn" />
        <div>
          <b>hopper.example.com has no Access policy.</b> Anyone with the link can load the frontend. Add it to the Access application before sharing.
        </div>
      </div>
    </div>
  )
}
