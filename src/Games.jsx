import { useStore, statusOf } from './store'
import { Glyph, Icon, Status, ago } from './ui'
import { Actions } from './App'
import { GAMES } from './extra'

export default function Games() {
  const { state, engine } = useStore()
  const games = state.registry.filter((p) => GAMES[p.id])
  return (
    <div className="page games">
      <header className="page-head">
        <div>
          <h1>Games</h1>
          <p className="muted small">Unity projects, builds and dedicated servers. The Editor needs the logged-in desktop; it does not stream to your phone.</p>
        </div>
      </header>
      {games.map((p) => {
        const g = GAMES[p.id]
        const st = statusOf(state, p)
        return (
          <section key={p.id} className="panel">
            <header className="panel-h">
              <a href={'#project-' + p.id} className="cell-name">
                <Glyph p={p} size={34} />
                <span className="cell-stack">
                  <h2>{p.name}</h2>
                  <span className="small muted">{p.kind}, Unity {g.editor}</span>
                </span>
              </a>
              <div className="actions">
                <Status status={st} />
                <Actions p={p} open={false} />
              </div>
            </header>
            <div className="grid-2">
              <div className="panel-inset">
                <h3 className="sub-h">Scenes</h3>
                <ul className="plain-list">
                  {g.scenes.map((s) => (
                    <li key={s}>
                      <span><code>{s}.unity</code></span>
                      <button className="btn btn-sm" disabled={st === 'offline'} onClick={() => engine.toast(`The agent would open ${s} in Unity ${g.editor} on ${p.machine}.`)}>
                        Open in Editor
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel-inset">
                <h3 className="sub-h">Builds</h3>
                <ul className="plain-list">
                  {g.builds.map((b) => (
                    <li key={b.ver}>
                      <span className="cell-stack">
                        <b>{b.ver}</b>
                        <span className="small muted">{b.target}, {b.size}, {ago(b.at)}</span>
                        {b.note && <span className="small c-bad">{b.note}</span>}
                      </span>
                      <Status status={b.ok ? 'running' : 'failed'} label={b.ok ? 'Built' : 'Failed'} />
                    </li>
                  ))}
                </ul>
                <button className="btn btn-sm" onClick={() => engine.toast('The agent would run Unity in batch mode with -buildTarget Win64.')}>
                  <Icon name="play" />
                  <span>New build</span>
                </button>
              </div>
            </div>
            {p.udp && (
              <div className="inset-note">
                <span className="label">Multiplayer</span>
                <p>
                  {st === 'running' ? '0 of 8 players connected.' : 'Server stopped.'} UDP {p.port} works on your LAN only; Cloudflare Tunnel doesn’t carry UDP. Remote playtests need a relay or VPN.
                </p>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
