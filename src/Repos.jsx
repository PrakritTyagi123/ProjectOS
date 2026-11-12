import { useStore } from './store'
import { Glyph, Icon, ago } from './ui'
import { GIT } from './extra'

export default function Repos() {
  const { state, engine } = useStore()
  const list = state.registry.filter((p) => (state.modules[p.id] || []).includes('git'))
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Repositories</h1>
          <p className="muted small">Read from each project folder by the agent: branch, uncommitted changes and sync with the remote.</p>
        </div>
      </header>
      <section className="panel flat-panel">
        <div className="table-wrap">
          <table className="dense">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Branch</th>
                <th className="r">Changes</th>
                <th className="r">Sync</th>
                <th>Last commit</th>
                <th className="r" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const g = GIT[p.id]
                const c = g.commits[0]
                return (
                  <tr key={p.id}>
                    <td>
                      <a href={'#project-' + p.id} className="cell-name">
                        <Glyph p={p} size={22} />
                        <span className="cell-stack">
                          <b>{p.name}</b>
                          <span className="small muted">{g.remote}</span>
                        </span>
                      </a>
                    </td>
                    <td><code className="small">{g.branch}</code></td>
                    <td className={'r num ' + (g.dirty ? 'c-warn' : 'muted')}>{g.dirty ? `${g.dirty} files` : 'clean'}</td>
                    <td className="r num small">{g.ahead || g.behind ? <>↑{g.ahead} ↓{g.behind}</> : <span className="muted">in sync</span>}</td>
                    <td>
                      <div className="cell-stack">
                        <span className="small">{c.msg}</span>
                        <span className="small muted"><code>{c.sha}</code> {ago(c.at)}</span>
                      </div>
                    </td>
                    <td className="r">
                      <div className="actions">
                        <button className="btn btn-sm" disabled={!g.behind} onClick={() => engine.toast(`The agent would run git pull --ff-only in ${p.cwd}`)}>Pull</button>
                        {g.remote.startsWith('github.com') && (
                          <a className="btn btn-sm btn-icon" href={'https://' + g.remote} target="_blank" rel="noopener noreferrer" aria-label={`Open ${g.remote}`} title="Open on GitHub">
                            <Icon name="open" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
