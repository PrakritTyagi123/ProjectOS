import { useState } from 'react'
import { useStore } from './store'
import { Glyph, Icon } from './ui'
import { TASK_COLS, TASK_TYPES } from './extra'

const WIP = 3

export default function Tasks() {
  const { state, engine } = useStore()
  const [proj, setProj] = useState('all')
  const [title, setTitle] = useState('')
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const list = state.tasks.filter((t) => proj === 'all' || t.project === proj)
  const move = (id, col) => {
    const doing = state.tasks.filter((t) => t.col === 'doing' && t.id !== id).length
    if (col === 'doing' && doing >= WIP) return engine.toast(`Already ${WIP} tasks in progress. Finish one first.`, 'bad')
    engine.tasks(state.tasks.map((t) => (t.id === id ? { ...t, col } : t)))
  }
  const active = state.registry.find((p) => state.plan[p.id].state === 'active')
  const byId = Object.fromEntries(state.registry.map((p) => [p.id, p]))
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted small">Drag cards between columns. At most {WIP} in progress across all projects.</p>
        </div>
        <div className="head-tools">
          <label className="sel">
            <span>Project</span>
            <select id="tk-proj" value={proj} onChange={(e) => setProj(e.target.value)}>
              <option value="all">All projects</option>
              {state.registry.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim()) return
              const pid = proj === 'all' ? active?.id || state.registry[0].id : proj
              engine.tasks([...state.tasks, { id: 't' + Date.now(), project: pid, title: title.trim(), col: 'backlog', type: 'feature', milestone: state.plan[pid].milestone }])
              setTitle('')
              engine.toast(`Added to ${byId[pid].name} backlog.`, 'good')
            }}
          >
            <input id="tk-new" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`New task for ${proj === 'all' ? active?.name || 'project' : byId[proj].name}`} />
            <button className="btn" type="submit"><Icon name="plus" /><span>Add</span></button>
          </form>
        </div>
      </header>
      <div className="kanban">
        {TASK_COLS.map(([k, label]) => {
          const items = list.filter((t) => t.col === k)
          const over3 = k === 'doing' && state.tasks.filter((t) => t.col === 'doing').length >= WIP
          return (
            <section
              key={k}
              className={'kcol ' + (over === k ? 'kcol-over' : '')}
              onDragOver={(e) => (e.preventDefault(), setOver(k))}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => (e.preventDefault(), setOver(null), drag && move(drag, k))}
              aria-label={label}
            >
              <header className="kcol-h">
                <b>{label}</b>
                <span className={'num small ' + (over3 ? 'c-warn' : 'muted')}>{k === 'doing' ? `${state.tasks.filter((t) => t.col === 'doing').length} / ${WIP}` : items.length}</span>
              </header>
              <ul>
                {items.map((t) => {
                  const p = byId[t.project]
                  return (
                    <li key={t.id} className={'kcard ' + (drag === t.id ? 'dragging' : '')} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)}>
                      <div className="kcard-top">
                        <span className={'ttype ttype-' + t.type}>{TASK_TYPES[t.type]}</span>
                        {t.due && <span className={'small num ' + (t.due - Date.now() < 2 * 864e5 ? 'c-warn' : 'muted')}>due {new Date(t.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                      <p>{t.title}</p>
                      <div className="kcard-foot">
                        <a href={'#project-' + p.id} className="cell-name small">
                          <Glyph p={p} size={18} />
                          <span>{p.name}</span>
                        </a>
                        <select aria-label={`Move ${t.title}`} value={t.col} onChange={(e) => move(t.id, e.target.value)}>
                          {TASK_COLS.map(([c, l]) => (
                            <option key={c} value={c}>{l}</option>
                          ))}
                        </select>
                      </div>
                      {t.milestone && <span className="small muted">{t.milestone}</span>}
                    </li>
                  )
                })}
                {items.length === 0 && <li className="kempty small muted">Drop tasks here</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
