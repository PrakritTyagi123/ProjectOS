import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, statusOf } from './store'
import { CATEGORIES, MACHINES, PLAN_STATES } from './data'
import { Icon, Glyph, StatusPill, PlanChip, Button, clock, ago, uptime, useNow, gb } from './ui'
import { RunControls } from './App'

const STEPS = [
  ['spawn', 'Spawn process', 'Agent launches the approved executable inside a Job Object.'],
  ['boot', 'Boot', 'The app loads config, models and opens its port.'],
  ['health', 'Health check', 'Agent polls the health URL until it answers 200.'],
  ['ready', 'Ready', 'Only now does the dashboard call it running.'],
]

function Lifecycle({ p, r, st }) {
  const idx = st === 'running' ? 3 : st === 'starting' ? STEPS.findIndex((s) => s[0] === r.phase) : st === 'failed' ? 1 : -1
  return (
    <section className="panel span-2">
      <header className="panel-h">
        <h3>Lifecycle</h3>
        <span className="muted small">
          {st === 'running' && r.readyMs ? `Last start reached ready in ${(r.readyMs / 1000).toFixed(1)} s` : st === 'failed' ? 'Last start failed during boot' : 'Process exists is not the same as ready'}
        </span>
      </header>
      <ol className="steps">
        {STEPS.map(([k, t, d], i) => {
          const cls = st === 'failed' && i === idx ? 'step-bad' : i < idx || (i === idx && st === 'running') ? 'step-done' : i === idx ? 'step-now' : ''
          const skip = k === 'health' && !p.health
          return (
            <li key={k} className={'step ' + cls + (skip ? ' step-skip' : '')}>
              <span className="step-mark">{cls === 'step-done' ? <Icon name="check" size={12} /> : cls === 'step-bad' ? <Icon name="x" size={12} /> : i + 1}</span>
              <b>{t}</b>
              <span className="small muted">{skip ? 'No health URL. Ready means the process stayed alive.' : d}</span>
            </li>
          )
        })}
      </ol>
      {st === 'failed' && (
        <div className="callout callout-bad">
          <Icon name="warn" />
          <div>
            <b>{r.error}</b>
            <div className="small">The agent never marks a failed launch as running. Check the last error lines in Logs.</div>
          </div>
        </div>
      )}
      {p.interactive && (
        <div className="callout">
          <Icon name="warn" />
          <div className="small">Opens a window on the desktop session. This needs you logged in on the PC; it won’t stream to your phone.</div>
        </div>
      )}
      {p.udp && (
        <div className="callout">
          <Icon name="warn" />
          <div className="small">UDP 7777 isn’t carried by Cloudflare Tunnel. Players can join on your LAN, or later through a relay or VPN.</div>
        </div>
      )}
    </section>
  )
}

function Field({ k, children }) {
  return (
    <div className="kv">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function OverviewTab({ p, r, st, setTab }) {
  const { state } = useStore()
  const pl = state.plan[p.id]
  const running = st === 'running'
  const errors = r.logs.filter((l) => l.stream === 'err').slice(-3)
  return (
    <div className="tab-grid">
      <Lifecycle p={p} r={r} st={st} />

      <section className="panel">
        <header className="panel-h">
          <h3>Health</h3>
          {p.health && running && <span className="pill pill-good pill-sm"><span className="dot" />Passing</span>}
        </header>
        <dl className="kvs">
          <Field k="Endpoint">{p.health ? <code>{p.health}</code> : <span className="muted">None configured</span>}</Field>
          <Field k="Last check">{running && r.health ? `${ago(r.health.at)}, ${r.health.ms} ms` : '–'}</Field>
          <Field k="Interval">Every 5 s while running</Field>
          <Field k="Uptime">{running ? uptime(r.startedAt) : '–'}</Field>
        </dl>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Process</h3>
        </header>
        <dl className="kvs">
          <Field k="PID">{running || st === 'starting' ? <span className="num">{r.pid}</span> : '–'}</Field>
          <Field k="Children">{running ? <span className="num">{p.kind === 'Python' ? 2 : 1} in job</span> : '–'}</Field>
          <Field k="Restart policy">{p.restart}</Field>
          <Field k="Last exit">{r.lastExit == null ? '–' : <span className={r.lastExit ? 'c-bad' : ''}>code {r.lastExit}</span>}</Field>
        </dl>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Resources</h3>
        </header>
        <div className="res">
          <div>
            <span className="muted small">CPU</span>
            <b className="num">{running ? r.cpu.toFixed(0) + '%' : '–'}</b>
          </div>
          <div>
            <span className="muted small">RAM</span>
            <b className="num">{running ? gb(r.ram) : '–'}</b>
          </div>
          <div>
            <span className="muted small">VRAM</span>
            <b className="num">{running && p.gpu ? gb(r.vram) : p.gpu ? '–' : 'n/a'}</b>
          </div>
        </div>
        {p.gpu && <p className="small muted">Expected VRAM when running: about {p.profile.vram} GB.{p.exclusiveGpu ? ' Marked GPU-exclusive.' : ''}</p>}
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Links</h3>
        </header>
        <dl className="kvs">
          <Field k="App">
            {p.frontend ? (
              <a href={p.frontend} target="_blank" rel="noopener noreferrer">
                {p.frontend.replace('https://', '')}
              </a>
            ) : (
              <span className="muted">No web frontend</span>
            )}
          </Field>
          <Field k="Repo">{p.repo}</Field>
          <Field k="Branch">
            <code>{p.branch}</code>
          </Field>
          <Field k="Commit">
            <code>{p.commit}</code> <span className="muted">{p.commitMsg}</span>
          </Field>
        </dl>
        {p.frontend && st !== 'running' && <p className="small muted">The app page still loads while the backend is stopped and shows its Backend offline screen.</p>}
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Next action</h3>
          <button className="link small" onClick={() => setTab('plan')}>
            Open plan
          </button>
        </header>
        <p className="next-big">{pl.next}</p>
        <div className="muted small">{pl.milestone}</div>
      </section>

      {(errors.length > 0 || p.deps.length > 0) && (
        <section className="panel">
          <header className="panel-h">
            <h3>{errors.length ? 'Recent errors' : 'Depends on'}</h3>
          </header>
          {errors.length ? (
            <pre className="mini-log">{errors.map((l) => l.text).join('\n')}</pre>
          ) : (
            <ul className="plain">
              {p.deps.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function LogsTab({ p, r }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [follow, setFollow] = useState(true)
  const [since, setSince] = useState(0)
  const box = useRef(null)
  const lines = r.logs.filter((l) => l.t >= since && (filter === 'all' || (filter === 'err' ? l.stream === 'err' : l.stream === 'agent')) && (!q || l.text.toLowerCase().includes(q.toLowerCase())))
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [lines.length, follow])
  return (
    <section className="panel logs-panel">
      <div className="toolbar">
        <div className="seg">
          {[
            ['all', 'All output'],
            ['err', 'Errors'],
            ['agent', 'Agent'],
          ].map(([k, v]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {v}
            </button>
          ))}
        </div>
        <label className="search">
          <Icon name="search" />
          <input id="log-search" type="search" placeholder="Filter lines" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="switch">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          <span>Follow</span>
        </label>
        <button className="link small" onClick={() => setSince(Date.now())}>
          Clear view
        </button>
      </div>
      <div className="log" ref={box} tabIndex={0} aria-label={`${p.name} logs`}>
        {lines.length === 0 && <div className="log-empty">No lines yet. Start the project to see its output here.</div>}
        {lines.map((l, i) => (
          <div key={i} className={'ll ll-' + l.stream}>
            <span className="ll-t">{clock(l.t)}</span>
            <span className="ll-s">{l.stream === 'agent' ? 'agent' : l.stream === 'err' ? 'stderr' : 'stdout'}</span>
            <span className="ll-x">{l.text}</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        Stored as rotating files in <code>D:\Projects\ProjectOS\logs\{p.id}</code>, 5 MB × 3. Secrets are redacted before they reach the API.
      </p>
    </section>
  )
}

function yaml(p) {
  const q = (s) => `'${s}'`
  const out = [
    `id: ${p.id}`,
    `name: ${p.name}`,
    `category: ${p.category}`,
    `machine: ${p.machine}`,
    `working_directory: ${q(p.cwd)}`,
    `launch:`,
    `  executable: ${q(p.exe)}`,
    `  args: [${p.args.map((a) => q(a)).join(', ')}]`,
  ]
  if (p.port || p.health || p.frontend) {
    out.push('network:')
    if (p.port) out.push(`  local_port: ${p.port}${p.udp ? '  # UDP' : ''}`)
    if (p.health) out.push(`  health_url: ${q(p.health)}`)
    if (p.frontend) out.push(`  frontend_url: ${q(p.frontend)}`)
  }
  out.push('resources:', `  gpu_required: ${p.gpu}`, `  exclusive_gpu_profile: ${!!p.exclusiveGpu}`, `  expected_vram_gb: ${p.profile.vram}`)
  if (p.interactive) out.push('session: interactive  # needs the logged-in desktop')
  if (p.job) out.push('type: job  # runs to completion, exit code is the result')
  out.push(`restart_policy: ${p.restart.split(' ')[0]}`)
  if (Object.keys(p.env).length) {
    out.push('env:')
    Object.entries(p.env).forEach(([k, v]) => out.push(`  ${k}: ${v.startsWith('•') ? '!secret ' + k.toLowerCase() : q(v)}`))
  }
  return out.join('\n')
}

function ConfigTab({ p }) {
  const text = useMemo(() => yaml(p), [p])
  const { engine } = useStore()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      engine.toast('Copied registry entry.', 'good')
    } catch {
      engine.toast('Copy is blocked here. Select the text instead.', 'bad')
    }
  }
  return (
    <div className="tab-grid">
      <section className="panel span-2">
        <header className="panel-h">
          <h3>registry.yaml entry</h3>
          <Button icon="copy" onClick={copy}>
            Copy
          </Button>
        </header>
        <pre className="code">{text}</pre>
        <p className="small muted">
          Read-only here. The browser can only ask the agent to run <code>{p.id}</code> by id; it never sends a path, a command or arguments. Edit this on {MACHINES[p.machine].id} and the agent reloads it.
        </p>
      </section>
      <section className="panel">
        <header className="panel-h">
          <h3>Environment</h3>
        </header>
        {Object.keys(p.env).length ? (
          <dl className="kvs">
            {Object.entries(p.env).map(([k, v]) => (
              <Field key={k} k={<code>{k}</code>}>
                {v.startsWith('•') ? <span className="muted">hidden secret</span> : <code className="wrap">{v}</code>}
              </Field>
            ))}
          </dl>
        ) : (
          <p className="muted small">No extra variables.</p>
        )}
      </section>
      <section className="panel">
        <header className="panel-h">
          <h3>Start order</h3>
        </header>
        {p.deps.length ? (
          <ol className="plain ordered">
            {p.deps.map((d) => (
              <li key={d}>{d}</li>
            ))}
            <li>
              <b>{p.name}</b>
            </li>
          </ol>
        ) : (
          <p className="muted small">No dependencies. Starts on its own.</p>
        )}
      </section>
    </div>
  )
}

function PlanTab({ p }) {
  const { state, engine } = useStore()
  const pl = state.plan[p.id]
  const [idea, setIdea] = useState('')
  const done = pl.dod.filter((d) => d.d).length
  const toggle = (i) => engine.plan(p.id, { dod: pl.dod.map((d, j) => (j === i ? { ...d, d: !d.d } : d)) })
  const mins = pl.sessions.reduce((a, s) => a + s.mins, 0)
  return (
    <div className="tab-grid">
      <section className="panel span-2">
        <header className="panel-h">
          <div>
            <h3>{pl.milestone}</h3>
            <span className="muted small">Definition of done</span>
          </div>
          <span className="num">
            {done}/{pl.dod.length}
          </span>
        </header>
        <div className="bar">
          <span className="bar-fill bar-good" style={{ width: (pl.dod.length ? (done / pl.dod.length) * 100 : 0) + '%' }} />
        </div>
        <ul className="dod">
          {pl.dod.map((d, i) => (
            <li key={i}>
              <label>
                <input type="checkbox" checked={d.d} onChange={() => toggle(i)} />
                <span className={d.d ? 'struck' : ''}>{d.t}</span>
              </label>
            </li>
          ))}
          {pl.dod.length === 0 && <li className="muted small">Write what “done” means before writing code.</li>}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Next action</h3>
        </header>
        <textarea id={'next-' + p.id} rows={3} value={pl.next} onChange={(e) => engine.plan(p.id, { next: e.target.value })} aria-label="Next action" />
        <p className="small muted">One concrete thing you can start in under five minutes.</p>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Blocker</h3>
        </header>
        <textarea id={'blk-' + p.id} rows={2} value={pl.blocker} placeholder="Nothing blocking" onChange={(e) => engine.plan(p.id, { blocker: e.target.value })} aria-label="Blocker" />
        <label className="small muted" htmlFor={'exp-' + p.id}>
          Next debugging experiment
        </label>
        <textarea id={'exp-' + p.id} rows={2} value={pl.experiment} onChange={(e) => engine.plan(p.id, { experiment: e.target.value })} />
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Resume notes</h3>
        </header>
        <textarea id={'res-' + p.id} rows={4} value={pl.resume} onChange={(e) => engine.plan(p.id, { resume: e.target.value })} aria-label="Resume notes" />
        <p className="small muted">What future you needs after three weeks away.</p>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Sessions</h3>
          <span className="muted small num">{(mins / 60).toFixed(1)} h logged</span>
        </header>
        {pl.sessions.length ? (
          <ul className="sessions">
            {pl.sessions.map((s, i) => (
              <li key={i}>
                <span className="num muted small">{s.date.slice(5)}</span>
                <span className="num">{s.mins} min</span>
                <span>{s.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No sessions logged yet.</p>
        )}
      </section>

      <section className="panel span-2">
        <header className="panel-h">
          <h3>Idea parking lot</h3>
          <span className="muted small">Kept, not built during this milestone</span>
        </header>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!idea.trim()) return
            engine.plan(p.id, { ideas: [...pl.ideas, idea.trim()] })
            setIdea('')
          }}
        >
          <input id={'idea-' + p.id} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Park an idea for later" />
          <Button icon="plus" type="submit">
            Park it
          </Button>
        </form>
        <ul className="tags">
          {pl.ideas.map((x, i) => (
            <li key={i}>
              {x}
              <button aria-label={`Remove ${x}`} onClick={() => engine.plan(p.id, { ideas: pl.ideas.filter((_, j) => j !== i) })}>
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ModelsTab({ p }) {
  const { state, engine } = useStore()
  const pl = state.plan[p.id]
  const st = statusOf(state, p)
  const sel = pl.selectedModel
  const [chars, setChars] = useState(p.characters)
  return (
    <div className="tab-grid">
      <section className="panel span-2">
        <header className="panel-h">
          <div>
            <h3>Models</h3>
            <span className="muted small">Found in D:\Models\llm. The selection applies on next start.</span>
          </div>
          {st === 'running' && sel !== 'qwen7' && <span className="pill pill-warn pill-sm"><span className="dot" />Restart to apply</span>}
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Model</th>
                <th>Quant</th>
                <th className="r">Context</th>
                <th className="r">File</th>
                <th className="r">VRAM</th>
              </tr>
            </thead>
            <tbody>
              {p.models.map((m) => (
                <tr key={m.id} className={sel === m.id ? 'sel' : ''} onClick={() => engine.plan(p.id, { selectedModel: m.id })}>
                  <td>
                    <input type="radio" name="model" id={'m-' + m.id} checked={sel === m.id} onChange={() => engine.plan(p.id, { selectedModel: m.id })} aria-label={m.name} />
                  </td>
                  <td>
                    <b>{m.name}</b>
                  </td>
                  <td><code>{m.quant}</code></td>
                  <td className="r num">{m.ctx.toLocaleString()}</td>
                  <td className="r num">{m.sizeGb} GB</td>
                  <td className={'r num ' + (m.vramGb > 10 ? 'c-warn' : '')}>{m.vramGb} GB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel span-2">
        <header className="panel-h">
          <h3>Characters</h3>
          <span className="muted small">{chars.filter((c) => c.on).length} enabled</span>
        </header>
        <ul className="char-list">
          {chars.map((c, i) => (
            <li key={c.name}>
              <label className="switch">
                <input type="checkbox" checked={c.on} onChange={() => setChars(chars.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
                <span>
                  <b>{c.name}</b> {c.note && <span className="muted small">{c.note}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default function ProjectPage({ p }) {
  const { state } = useStore()
  useNow(1000)
  const [tab, setTab] = useState('overview')
  const r = state.runtime[p.id]
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  const tabs = [['overview', 'Overview'], ...(p.models ? [['models', 'Models']] : []), ['logs', 'Logs'], ['config', 'Config'], ['plan', 'Plan']]
  const errCount = r.logs.filter((l) => l.stream === 'err').length

  return (
    <div className="page">
      <a href="#overview" className="crumb">
        <Icon name="back" /> All projects
      </a>
      <header className="proj-head">
        <Glyph p={p} size={52} />
        <div className="proj-title">
          <h1>{p.name}</h1>
          <p className="muted">{p.blurb}</p>
          <div className="proj-meta">
            <StatusPill status={st} />
            <PlanChip state={pl.state} />
            <span className="small muted">
              {CATEGORIES[p.category]}, {p.kind}, on {p.machine}
            </span>
            {st === 'running' && <span className="small muted">Up {uptime(r.startedAt)}</span>}
          </div>
        </div>
        <div className="proj-actions">
          <RunControls p={p} />
        </div>
      </header>

      {st === 'offline' && (
        <div className="callout">
          <Icon name="warn" />
          <div>
            <b>{MACHINES[p.machine].label} isn’t connected to ProjectOS.</b>
            <div className="small">{MACHINES[p.machine].note || 'Start the PC and the agent reconnects on its own.'}</div>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {tabs.map(([k, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {v}
            {k === 'logs' && errCount > 0 && <span className="tab-badge num">{errCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab p={p} r={r} st={st} setTab={setTab} />}
      {tab === 'logs' && <LogsTab p={p} r={r} />}
      {tab === 'config' && <ConfigTab p={p} />}
      {tab === 'plan' && <PlanTab p={p} />}
      {tab === 'models' && <ModelsTab p={p} />}
    </div>
  )
}
