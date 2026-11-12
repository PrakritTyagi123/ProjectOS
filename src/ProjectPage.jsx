import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, statusOf } from './store'
import { CATEGORIES, MACHINES, PLAN_STATES } from './data'
import { Icon, Glyph, StatusPill, PlanChip, Button, Knob, Heartbeat, LiveBars, Led, STATUS, clock, ago, uptime, useNow, gb, catVar } from './ui'
import { RunControls, Power, go } from './App'
import Readme from './Readme'

const STEPS = [
  ['spawn', 'Spawn', 'Approved executable launched inside a Job Object'],
  ['boot', 'Boot', 'Config, models and port come up'],
  ['health', 'Health check', 'Agent polls until it answers 200'],
  ['ready', 'Ready', 'Only now is it called running'],
]

function Lifecycle({ p, r, st }) {
  useNow(st === 'starting' ? 100 : 5000)
  const idx = st === 'running' ? 4 : st === 'starting' ? Math.max(0, STEPS.findIndex((s) => s[0] === r.phase)) : st === 'failed' ? 1 : -1
  const fill = st === 'running' ? 100 : idx <= 0 ? 0 : (idx / 3) * 100
  const elapsed = st === 'starting' && r.startedAt ? ((Date.now() - r.startedAt) / 1000).toFixed(1) : null
  return (
    <section className={'panel span-2 lifecycle lc-' + st}>
      <header className="panel-h">
        <h3>Lifecycle</h3>
        <span className={'lc-status st st-' + (st === 'running' ? 'good' : st === 'starting' ? 'busy' : st === 'failed' ? 'bad' : 'idle')}>
          {st === 'running' && r.readyMs ? `Ready in ${(r.readyMs / 1000).toFixed(1)} s` : st === 'failed' ? 'Failed during boot' : st === 'starting' ? <>Starting <span className="num">{elapsed} s</span></> : 'Stopped'}
        </span>
      </header>
      <ol className={'steps steps-' + st} style={{ '--fill': fill }}>
        {STEPS.map(([k, t, d], i) => {
          const cls = st === 'failed' && i === idx ? 'step-bad' : i < idx || st === 'running' ? 'step-done' : i === idx ? 'step-now' : ''
          const skip = k === 'health' && !p.health
          return (
            <li key={k} className={'step ' + cls + (skip ? ' step-skip' : '')} style={{ '--si': i }}>
              <span className="step-mark">{cls === 'step-done' ? <Icon name="check" size={15} /> : cls === 'step-bad' ? <Icon name="x" size={15} /> : <span className="num">{i + 1}</span>}</span>
              <b>{t}</b>
              <span className="small muted">{skip ? 'No health URL; alive process counts as ready' : d}</span>
              {cls === 'step-now' && <span className="step-live small num">{k === 'health' ? 'Polling' : 'Working'} for {elapsed} s</span>}
            </li>
          )
        })}
      </ol>
      {st === 'failed' && (
        <div className="callout callout-bad">
          <Icon name="warn" />
          <div>
            <b>{r.error}</b>
            <div className="small">A failed launch is never shown as running. The last error lines are in Logs.</div>
          </div>
        </div>
      )}
      {p.interactive && (
        <div className="callout">
          <Icon name="warn" />
          <div className="small">Opens a window on the desktop session. You need to be logged in on the PC, and it won’t stream to your phone.</div>
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

function Metric({ label, value, data, color }) {
  return (
    <div className="metric" style={{ '--c': color }}>
      <span className="small muted">{label}</span>
      <b className="num">{value}</b>
      <LiveBars data={data} color={color} />
    </div>
  )
}

function OverviewTab({ p, r, st, setTab }) {
  const { state } = useStore()
  const pl = state.plan[p.id]
  const running = st === 'running'
  const tail = r.logs.slice(-9)
  const c = catVar(p.category)
  const ramHist = r.hist.map((v) => (v ? p.profile.ram * (0.9 + (v % 7) / 50) : 0))
  const vramHist = r.hist.map((v) => (v && p.gpu ? p.profile.vram * (0.95 + (v % 5) / 80) : 0))
  return (
    <div className="tab-grid">
      <Lifecycle p={p} r={r} st={st} />

      <section className="panel health">
        <header className="panel-h">
          <h3>Health</h3>
          <span className={'st st-' + (running ? 'good' : st === 'failed' ? 'bad' : 'idle')}>
            <Led status={running ? 'running' : st === 'failed' ? 'failed' : 'stopped'} />
            {running ? (p.health ? `${r.health?.ms ?? 9} ms` : 'Alive') : st === 'failed' ? 'Down' : 'No signal'}
          </span>
        </header>
        <Heartbeat alive={running} tone={st === 'failed' ? 'bad' : 'good'} height={54} />
        <dl className="kvs">
          <Field k="Endpoint">{p.health ? <code>{p.health}</code> : <span className="muted">None configured</span>}</Field>
          <Field k="Last check">{running && r.health ? ago(r.health.at) : '–'}</Field>
          <Field k="Uptime">{running ? uptime(r.startedAt) : '–'}</Field>
          <Field k="PID">{running || st === 'starting' ? <span className="num">{r.pid}</span> : '–'}</Field>
        </dl>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h3>Resources</h3>
          <span className="muted small">{p.gpu ? `Expects ~${p.profile.vram} GB VRAM${p.exclusiveGpu ? ', GPU-exclusive' : ''}` : 'CPU only'}</span>
        </header>
        <div className="metrics">
          <Metric label="CPU" value={running ? r.cpu.toFixed(0) + '%' : '–'} data={r.hist} color={c} />
          <Metric label="RAM" value={running ? gb(r.ram) : '–'} data={ramHist} color="var(--c-tools)" />
          <Metric label="VRAM" value={p.gpu ? (running ? gb(r.vram) : '–') : 'n/a'} data={vramHist} color="var(--c-games)" />
        </div>
      </section>

      <section className="panel span-2 tail">
        <header className="panel-h">
          <h3>Live output</h3>
          <button className="link small" onClick={() => setTab('logs')}>
            Full logs
          </button>
        </header>
        <div className="log log-short">
          {tail.length === 0 && <div className="log-empty">No output yet.</div>}
          {tail.map((l, i) => (
            <div key={l.t + '-' + i} className={'ll ll-' + l.stream}>
              <span className="ll-t">{clock(l.t)}</span>
              <span className="ll-x">{l.text}</span>
            </div>
          ))}
        </div>
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
            <code>{p.branch}</code> <code className="muted">{p.commit}</code>
          </Field>
          <Field k="Depends on">{p.deps.length ? p.deps.join(', ') : <span className="muted">Nothing</span>}</Field>
        </dl>
      </section>
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
        <div className="seg has-knob">
          <Knob />
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

export default function ProjectPage({ p, readme }) {
  const { state } = useStore()
  useNow(1000)
  const [tab, setTabRaw] = useState(readme ? 'readme' : 'overview')
  useEffect(() => {
    if (readme) setTabRaw('readme')
    else setTabRaw((t) => (t === 'readme' ? 'overview' : t))
  }, [readme])
  // README has its own address (#readme-<id>) so it can be bookmarked or shared.
  const setTab = (k) => {
    if (k === 'readme') return go('readme-' + p.id)
    setTabRaw(k)
    if (readme) go('project-' + p.id)
  }
  const r = state.runtime[p.id]
  const st = statusOf(state, p)
  const pl = state.plan[p.id]
  const tabs = [['overview', 'Overview'], ['readme', 'README'], ...(p.models ? [['models', 'Models']] : []), ['logs', 'Logs'], ['config', 'Config'], ['plan', 'Plan']]
  const errCount = r.logs.filter((l) => l.stream === 'err').length

  return (
    <div className="page">
      <header className={'proj-hero ph-' + st} style={{ '--c': catVar(p.category), '--h': p.hue }}>
        <a href="#overview" className="crumb">
          <Icon name="back" /> All projects
        </a>
        <div className="ph-row">
          <Power p={p} big />
          <div className="ph-title">
            <h1>{p.name}</h1>
            <p>{p.blurb}</p>
            <div className="ph-meta">
              <span className={'st st-' + STATUS[st].tone}>
                <Led status={st} />
                {STATUS[st].label}
                {st === 'running' && <span className="num"> {uptime(r.startedAt)}</span>}
              </span>
              <PlanChip state={pl.state} />
              <span className="ph-tag">{CATEGORIES[p.category]}</span>
              <span className="ph-tag">{p.kind}</span>
              <span className="ph-tag">{p.machine}</span>
              {p.port && <span className="ph-tag num">{p.udp ? 'UDP' : 'port'} {p.port}</span>}
            </div>
          </div>
          <div className="ph-actions">
            <RunControls p={p} />
          </div>
        </div>
        {st === 'starting' && <div className="ph-progress" />}
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

      <div className="tabs has-knob" role="tablist">
        <Knob />
        {tabs.map(([k, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {v}
            {k === 'logs' && errCount > 0 && <span className="tab-badge num">{errCount}</span>}
          </button>
        ))}
      </div>

      <div className="tab-body" key={tab}>
        {tab === 'readme' && <Readme p={p} />}
        {tab === 'overview' && <OverviewTab p={p} r={r} st={st} setTab={setTab} />}
        {tab === 'logs' && <LogsTab p={p} r={r} />}
        {tab === 'config' && <ConfigTab p={p} />}
        {tab === 'plan' && <PlanTab p={p} />}
        {tab === 'models' && <ModelsTab p={p} />}
      </div>
    </div>
  )
}
