import { useState } from 'react'
import { useStore } from './store'
import { CATEGORIES } from './data'
import { Modal, Button, Icon, Select } from './ui'
import { go } from './App'

const TYPES = {
  python: { label: 'Python', exe: 'D:\\Projects\\MyApp\\.venv\\Scripts\\python.exe', args: '-m uvicorn main:app --port 8020', kind: 'Python' },
  node: { label: 'Node', exe: 'C:\\Program Files\\nodejs\\node.exe', args: 'dist\\index.js', kind: 'Node' },
  unity: { label: 'Unity build', exe: 'D:\\Builds\\MyGame\\MyGame.exe', args: '-batchmode -nographics', kind: 'Unity server' },
  exe: { label: 'Other program', exe: 'D:\\Tools\\tool.exe', args: '', kind: 'Program' },
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function AddProject({ onClose }) {
  const { state, engine } = useStore()
  const [f, setF] = useState({
    type: 'python',
    name: 'Rainfall Nowcast',
    category: 'ai',
    cwd: 'D:\\Projects\\RainfallNowcast',
    exe: 'D:\\Projects\\RainfallNowcast\\.venv\\Scripts\\python.exe',
    args: '-m uvicorn api:app --port 8020',
    port: '8020',
    health: 'http://127.0.0.1:8020/health',
    frontend: 'https://rain.example.com',
    gpu: false,
  })
  const [checks, setChecks] = useState(null)
  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
    setChecks(null)
  }
  const id = slug(f.name)

  const validate = () => {
    const used = state.registry.map((p) => p.port).filter(Boolean)
    const port = Number(f.port)
    const c = [
      [!!f.name.trim() && !state.registry.some((p) => p.id === id), `Id “${id || '…'}” is free`, 'Pick a different name; that id already exists.'],
      [/^[A-Za-z]:\\/.test(f.cwd), 'Working directory exists on desktop-01', 'Use an absolute Windows path like D:\\Projects\\App.'],
      [/\.exe$/i.test(f.exe), 'Executable found', 'Point at an .exe (python.exe, node.exe, a game build).'],
      [!/[;&|`$><]/.test(f.args), 'Arguments contain no shell operators', 'Remove ; & | > and similar. The agent never runs a shell.'],
      [!f.port || (port > 1023 && port < 65536 && !used.includes(port)), f.port ? `Port ${f.port} is free` : 'No port (process-only project)', `Port ${f.port} is taken or out of range.`],
      [!f.health || /^http:\/\/(127\.0\.0\.1|localhost)/.test(f.health), f.health ? 'Health URL is local' : 'No health URL; ready means the process stayed alive', 'Health checks must hit 127.0.0.1.'],
    ]
    setChecks(c)
  }
  const ok = checks && checks.every((c) => c[0])

  const register = () => {
    const t = TYPES[f.type]
    engine.register({
      id,
      name: f.name.trim(),
      blurb: 'Registered from the dashboard.',
      category: f.category,
      kind: t.kind,
      hue: Math.floor(Math.random() * 360),
      machine: 'desktop-01',
      cwd: f.cwd,
      exe: f.exe,
      args: f.args.split(' ').filter(Boolean),
      port: f.port ? Number(f.port) : null,
      health: f.health || null,
      frontend: f.frontend || null,
      repo: 'not set',
      branch: '–',
      commit: '–',
      commitMsg: '',
      restart: 'manual',
      gpu: f.gpu,
      profile: { cpu: 6, ram: 0.9, vram: f.gpu ? 2 : 0 },
      deps: [],
      env: {},
      bootMs: 4000,
      bootLines: ['Started'],
      traffic: ['GET /health 200'],
    })
    engine.toast(`${f.name} registered.`, 'good')
    onClose()
    go('project-' + id)
  }

  return (
    <Modal title="Add project" onClose={onClose} wide>
      <p className="muted small">
        The project’s code stays as it is. You’re telling the agent how to run it. In v0.1 this writes to registry.yaml on desktop-01; here it only updates the demo.
      </p>
      <div className="seg type-seg" role="radiogroup" aria-label="Project type">
        {Object.entries(TYPES).map(([k, t]) => (
          <button
            key={k}
            role="radio"
            aria-checked={f.type === k}
            className={f.type === k ? 'on' : ''}
            onClick={() => {
              setF({ ...f, type: k, exe: t.exe, args: t.args })
              setChecks(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="form">
        <label>
          Name
          <input id="f-name" value={f.name} onChange={set('name')} />
          <span className="hint">Id: {id || '…'}</span>
        </label>
        <div className="form-field">
          <span>Category</span>
          <Select id="f-cat" ariaLabel="Category" value={f.category} onChange={(v) => (setF({ ...f, category: v }), setChecks(null))} options={Object.entries(CATEGORIES)} />
        </div>
        <label className="full">
          Working directory
          <input id="f-cwd" value={f.cwd} onChange={set('cwd')} spellCheck="false" />
        </label>
        <label className="full">
          Executable
          <input id="f-exe" value={f.exe} onChange={set('exe')} spellCheck="false" />
        </label>
        <label className="full">
          Arguments
          <input id="f-args" value={f.args} onChange={set('args')} spellCheck="false" />
          <span className="hint">Passed as a list. No shell, no pipes.</span>
        </label>
        <label>
          Port
          <input id="f-port" value={f.port} onChange={set('port')} inputMode="numeric" />
        </label>
        <label>
          Health URL
          <input id="f-health" value={f.health} onChange={set('health')} spellCheck="false" />
        </label>
        <label className="full">
          App URL
          <input id="f-front" value={f.frontend} onChange={set('frontend')} spellCheck="false" />
        </label>
        <label className="switch full">
          <input id="f-gpu" type="checkbox" checked={f.gpu} onChange={set('gpu')} />
          <span>Uses the GPU</span>
        </label>
      </div>

      {checks && (
        <ul className="checks">
          {checks.map(([pass, good, bad], i) => (
            <li key={i} className={pass ? 'ok' : 'no'}>
              <Icon name={pass ? 'check' : 'x'} size={14} />
              {pass ? good : bad}
            </li>
          ))}
        </ul>
      )}

      <div className="modal-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={validate}>Check setup</Button>
        <Button variant="primary" icon="plus" disabled={!ok} onClick={register} title={ok ? '' : 'Run Check setup first'}>
          Register project
        </Button>
      </div>
    </Modal>
  )
}
