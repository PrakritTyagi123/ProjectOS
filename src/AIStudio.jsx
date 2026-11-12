import { useStore, statusOf } from './store'
import { Glyph, Icon, Status, ago, useNow, gb } from './ui'
import { Actions } from './App'
import { INITIAL_JOBS, WORKFLOWS } from './extra'

export default function AIStudio() {
  const { state, engine } = useStore()
  useNow(1000)
  const servers = state.registry.filter((p) => p.category === 'ai' || p.id === 'hopper').filter((p) => p.gpu || p.id === 'q-nivaran')
  const comp = state.registry.find((p) => p.id === 'ai-companion')
  const sel = state.plan['ai-companion']?.selectedModel
  const byId = Object.fromEntries(state.registry.map((p) => [p.id, p]))
  const jobAct = (j) => {
    if (j.state === 'running') return engine.job(j.id, { state: 'paused' })
    if (byId[j.project].machine !== 'desktop-01') return engine.toast('That job runs on the office machine.', 'bad')
    if (!state.machines['desktop-01']) return engine.toast('desktop-01 is offline.', 'bad')
    engine.job(j.id, { state: 'running' })
  }
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>AI Studio</h1>
          <p className="muted small">Inference servers, local models, ComfyUI workflows and long jobs, all sharing one RTX 4080.</p>
        </div>
      </header>

      <section className="panel flat-panel">
        <header className="panel-h"><h2>Inference servers</h2></header>
        <div className="table-wrap"><table className="dense">
          <thead>
            <tr><th>Server</th><th>State</th><th className="r">VRAM</th><th>Expected</th><th className="r" /></tr>
          </thead>
          <tbody>
            {servers.map((p) => {
              const st = statusOf(state, p)
              return (
                <tr key={p.id}>
                  <td><a href={'#project-' + p.id} className="cell-name"><Glyph p={p} size={22} /><b>{p.name}</b></a></td>
                  <td><Status status={st} /></td>
                  <td className="r num">{st === 'running' ? gb(state.runtime[p.id].vram) : '–'}</td>
                  <td className="small muted">{p.gpu ? `~${p.profile.vram} GB${p.exclusiveGpu ? ', exclusive' : ''}` : 'CPU only'}</td>
                  <td className="r"><Actions p={p} /></td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </section>

      <div className="grid-2">
        <section className="panel flat-panel">
          <header className="panel-h">
            <h2>Local models</h2>
            <a href="#project-ai-companion" className="small">AI Companion</a>
          </header>
          <div className="table-wrap"><table className="dense">
            <thead><tr><th>Model</th><th>Quant</th><th className="r">VRAM</th><th /></tr></thead>
            <tbody>
              {comp.models.map((m) => (
                <tr key={m.id} onClick={() => engine.plan('ai-companion', { selectedModel: m.id })} className={sel === m.id ? 'is-sel' : ''}>
                  <td><b>{m.name}</b><div className="small muted">ctx {m.ctx.toLocaleString()}</div></td>
                  <td><code className="small">{m.quant}</code></td>
                  <td className="r num">{m.vramGb} GB</td>
                  <td className="r">{sel === m.id ? <span className="prio prio-active">Next start</span> : <button className="btn btn-sm">Use</button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
        <section className="panel flat-panel">
          <header className="panel-h">
            <h2>ComfyUI workflows</h2>
            <a href="#project-comfyui" className="small">ComfyUI</a>
          </header>
          <ul className="plain-list">
            {WORKFLOWS.map((w) => (
              <li key={w.name}>
                <span className="cell-stack">
                  <code>{w.name}.json</code>
                  <span className="small muted">{w.nodes} nodes, used {ago(w.last)}</span>
                </span>
                <button className="btn btn-sm" onClick={() => engine.toast('Queueing workflows arrives with the ComfyUI module.')}>Queue</button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <header className="panel-h">
          <h2>Jobs</h2>
          <span className="muted small">Training, evaluation and experiments. Long jobs pause instead of fighting a chat model for VRAM.</span>
        </header>
        <ul className="jobs">
          {state.jobs.map((j) => {
            const p = byId[j.project]
            return (
              <li key={j.id}>
                <Glyph p={p} size={28} />
                <div className="cell-stack">
                  <b>{j.name}</b>
                  <span className="small muted">{j.kind} for {p.name}{j.note ? `, ${j.note}` : ''}</span>
                </div>
                <div className="job-bar"><i style={{ width: j.progress * 100 + '%' }} className={'jb-' + j.state} /></div>
                <span className="num small">{Math.round(j.progress * 100)}%</span>
                <Status status={j.state === 'running' ? 'starting' : j.state === 'done' ? 'running' : 'stopped'} label={{ running: `Running, ~${j.eta} min left`, paused: 'Paused', queued: 'Queued', done: 'Done' }[j.state]} />
                <button className="btn btn-sm" disabled={j.state === 'done'} onClick={() => jobAct(j)}>
                  <Icon name={j.state === 'running' ? 'stop' : 'play'} />
                  <span>{j.state === 'running' ? 'Pause' : j.state === 'queued' ? 'Start' : 'Resume'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
