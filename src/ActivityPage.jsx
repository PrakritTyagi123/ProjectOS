import { useState } from 'react'
import { useStore } from './store'
import { Glyph, Select, ago, clock, useNow } from './ui'

const TYPES = { runtime: 'Runtime', crash: 'Crash', commit: 'Commit', session: 'Work session', milestone: 'Milestone', build: 'Build', training: 'Training', deploy: 'Deploy', access: 'Access', registry: 'Registry' }
const dayLabel = (t) => {
  const d = new Date(t)
  const today = new Date()
  const y = new Date(Date.now() - 864e5)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function ActivityPage() {
  const { state } = useStore()
  useNow(10000)
  const [proj, setProj] = useState('all')
  const [type, setType] = useState('all')
  const [mach, setMach] = useState('all')
  const list = state.activity.filter((a) => (proj === 'all' || a.project === proj) && (type === 'all' || a.type === type) && (mach === 'all' || a.machine === mach))
  const groups = []
  list.forEach((a) => {
    const k = dayLabel(a.t)
    const g = groups[groups.length - 1]
    if (g && g.k === k) g.items.push(a)
    else groups.push({ k, items: [a] })
  })
  const byId = Object.fromEntries(state.registry.map((p) => [p.id, p]))
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="muted small">Launches, crashes, commits, builds, sessions and sign-ins in one history.</p>
        </div>
      </header>
      <div className="filters panel-inset">
        <Select id="ac-proj" label="Project" value={proj} onChange={setProj} options={[['all', 'All'], ...state.registry.map((p) => [p.id, p.name])]} />
        <Select id="ac-type" label="Type" value={type} onChange={setType} options={[['all', 'All'], ...Object.entries(TYPES)]} />
        <Select id="ac-mach" label="Machine" value={mach} onChange={setMach} options={[['all', 'All'], 'desktop-01', 'office-ws']} />
        <span className="muted small num">{list.length} events</span>
      </div>
      {groups.map((g) => (
        <section key={g.k} className="panel flat-panel">
          <header className="panel-h"><h2>{g.k}</h2></header>
          <ul className="timeline">
            {g.items.map((a, i) => {
              const p = a.project && byId[a.project]
              return (
                <li key={i} className={'tl-' + (a.bad ? 'bad' : a.type)}>
                  <span className="tl-time num small muted">{clock(a.t).slice(0, 5)}</span>
                  <span className="tl-dot" />
                  <span className="tl-type small">{TYPES[a.type] || a.action}</span>
                  <span className="tl-body">
                    {p ? (
                      <a href={'#project-' + p.id} className="cell-name"><Glyph p={p} size={18} /><b>{p.name}</b></a>
                    ) : (
                      <b>{a.action}</b>
                    )}
                    <span className={a.bad ? 'c-bad' : ''}>{a.result}</span>
                  </span>
                  <span className="small muted tl-who">{a.who}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <div className="panel empty"><p>No events match these filters.</p></div>}
    </div>
  )
}
