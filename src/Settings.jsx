import { useStore } from './store'
import { Icon } from './ui'
import { ThemeSwitch, useUi } from './App'
import { Knob } from './ui'

function Row({ label, help, children }) {
  return (
    <div className="set-row">
      <div>
        <b>{label}</b>
        {help && <p className="small muted">{help}</p>}
      </div>
      <div className="set-ctl">{children}</div>
    </div>
  )
}

export default function Settings({ collapsed, setCollapsed }) {
  const { state, engine } = useStore()
  const ui = useUi()
  const desk = state.machines['desktop-01']
  const copy = async () => {
    const data = JSON.stringify({ plan: state.plan, inbox: state.inbox, tasks: state.tasks, modules: state.modules, profile: state.profile }, null, 2)
    try {
      await navigator.clipboard.writeText(data)
      engine.toast('Planning data copied as JSON.', 'good')
    } catch {
      engine.toast('Copy is blocked here.', 'bad')
    }
  }
  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted small">Preferences are saved in this browser. Agent settings live in the agent’s config on each machine.</p>
        </div>
      </header>

      <section className="panel">
        <h2>Appearance</h2>
        <Row label="Theme" help="Charcoal (dark), graphite (light), or follow the system.">
          <ThemeSwitch />
        </Row>
        <Row label="Density" help="Compact fits 15 or more projects on one screen.">
          <div className="seg has-knob" role="radiogroup" aria-label="Density">
            <Knob />
            {['comfortable', 'compact'].map((k) => (
              <button key={k} role="radio" aria-checked={ui.density === k} className={ui.density === k ? 'on' : ''} onClick={() => ui.setDensity(k)}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Command palette" help="Start, stop or open anything from the keyboard.">
          <span className="small"><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
        </Row>
        <Row label="Collapsed sidebar" help="Icons only. Hover an icon to see its name.">
          <label className="switch">
            <input id="set-collapse" type="checkbox" checked={collapsed} onChange={(e) => setCollapsed(e.target.checked)} />
            <span>{collapsed ? 'On' : 'Off'}</span>
          </label>
        </Row>
      </section>

      <section className="panel">
        <h2>Agent and security</h2>
        <Row label="Connection" help={state.mode === 'live' ? 'Talking to the real agent through /api.' : 'No agent answered at /api, so everything here is simulated.'}>
          <span className={'status status-' + (state.mode === 'live' ? 'good' : 'idle')}>
            <span className={'led led-' + (state.mode === 'live' ? 'good' : 'idle')} />
            <span>{state.mode === 'live' ? `Live: ${state.agent?.machine || 'agent'} ${state.agent?.version || ''}` : 'Demo mode'}</span>
          </span>
        </Row>
        {state.mode === 'live' && state.agent?.warnings?.length > 0 && (
          <Row label="Registry warnings" help="Fix these in registry.yaml on the PC; the agent reloads it automatically.">
            <ul className="small c-warn warn-list">{state.agent.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </Row>
        )}
        <Row label="API" help="Same-origin. A Pages Function forwards /api/* to the tunnel with a service token.">
          <code className="well-code">/api → agent.example.com</code>
        </Row>
        <Row label="Cloudflare Access" help="Required for the dashboard and the API. The agent also checks the Access JWT itself.">
          <span className="status status-good"><span className="led led-good" /><span>On, 1 allowed email</span></span>
        </Row>
        <Row label="Allowed actions" help="The browser can only ask for these, by project id. No paths, commands or shell.">
          <span className="small">start, stop, restart, logs, health, metrics</span>
        </Row>
        <Row label="Audit log" help="Every remote action is recorded with the device it came from.">
          <a href="#activity" className="btn btn-sm">Open activity</a>
        </Row>
      </section>

      <section className="panel">
        <h2>Data</h2>
        <Row label="Back up planning data" help="Plan, inbox, tasks, modules and profiles as JSON.">
          <button className="btn btn-sm" onClick={copy}>
            <Icon name="copy" />
            <span>Copy JSON</span>
          </button>
        </Row>
      </section>

      {state.mode !== 'live' && <section className="panel">
        <h2>Demo</h2>
        <Row label="Simulate PC asleep" help="Shows how every page behaves when the agent can’t be reached.">
          <label className="switch">
            <input id="set-sleep" type="checkbox" checked={!desk} onChange={(e) => engine.setMachine('desktop-01', !e.target.checked)} />
            <span>{desk ? 'Awake' : 'Asleep'}</span>
          </label>
        </Row>
        <Row label="Reset demo" help="Restores the sample projects, plan and tasks.">
          <button className="btn btn-sm btn-danger" onClick={engine.reset}>
            Reset
          </button>
        </Row>
      </section>}
    </div>
  )
}
