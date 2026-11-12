import { useStore } from './store'
import { Glyph, ago, clock, useNow } from './ui'

const TONE = { Start: 'good', 'Run job': 'good', Stop: 'idle', Restart: 'busy', Register: 'accent', 'Sign-in': 'bad' }

export default function ActivityPage() {
  const { state } = useStore()
  useNow(10000)
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="muted">Every remote start, stop and sign-in, with the device it came from.</p>
        </div>
      </header>
      <section className="panel">
        <div className="table-wrap">
          <table className="table activity">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Project</th>
                <th>From</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {state.activity.map((a, i) => {
                const p = a.project && state.registry.find((x) => x.id === a.project)
                return (
                  <tr key={i} className={'act-' + (a.bad ? 'bad' : TONE[a.action] || 'idle')}>
                    <td>
                      <span>{ago(a.t)}</span>
                      <span className="muted small num"> {clock(a.t).slice(0, 5)}</span>
                    </td>
                    <td>
                      <b className="act-badge">{a.action}</b>
                    </td>
                    <td>
                      {p ? (
                        <a href={'#project-' + p.id} className="cell-proj">
                          <Glyph p={p} size={20} />
                          {p.name}
                        </a>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                    <td className="muted">{a.who}</td>
                    <td className={a.bad ? 'c-bad' : ''}>{a.result}</td>
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
