import { useRef, useState } from 'react'
import { useWeek, todayIdx } from './week'
import { useStore } from './store'
import { PLAN_STATES } from './data'
import { Icon, Glyph, Button, Num, catVar } from './ui'

function Card({ p }) {
  const { state, engine } = useStore()
  const pl = state.plan[p.id]
  const done = pl.dod.filter((d) => d.d).length
  const move = (to) => {
    if (to === pl.state) return
    if (to === 'active') {
      const cur = state.registry.find((x) => state.plan[x.id].state === 'active')
      if (cur) return engine.toast(`${cur.name} is still active. Ship it, or park it with a resume note, before switching.`, 'bad')
    }
    engine.plan(p.id, { state: to })
    engine.toast(`${p.name} moved to ${PLAN_STATES[to].label}.`)
  }
  return (
    <li className={'pcard pcard-' + pl.state} style={{ '--c': catVar(p.category) }}>
      <a href={'#project-' + p.id} className="pcard-h">
        <Glyph p={p} size={26} />
        <b>{p.name}</b>
      </a>
      <div className="small pcard-ms">{pl.milestone}</div>
      {pl.dod.length > 0 && (
        <div className="pcard-prog">
          <div className="bar">
            <span className="bar-fill bar-good" style={{ width: (done / pl.dod.length) * 100 + '%' }} />
          </div>
          <span className="num small">
            {done}/{pl.dod.length}
          </span>
        </div>
      )}
      <p className="small pcard-next">{pl.next}</p>
      {pl.blocker && (
        <p className="small c-bad pcard-blk">
          <Icon name="warn" size={12} /> {pl.blocker}
        </p>
      )}
      <label className="pcard-move small muted">
        Move to
        <select id={'mv-' + p.id} value={pl.state} onChange={(e) => move(e.target.value)}>
          {Object.entries(PLAN_STATES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
    </li>
  )
}

const MAXH = 6
function DaySlider({ d, i, today, onChange }) {
  const col = useRef(null)
  const setFromY = (y) => {
    const r = col.current.getBoundingClientRect()
    const h = Math.round(((r.bottom - y) / r.height) * MAXH * 2) / 2
    onChange(Math.max(0, Math.min(MAXH, h)))
  }
  const down = (e) => {
    if (d.rest) return
    e.preventDefault()
    col.current.setPointerCapture(e.pointerId)
    setFromY(e.clientY)
  }
  const move = (e) => col.current.hasPointerCapture?.(e.pointerId) && setFromY(e.clientY)
  const key = (e) => {
    if (d.rest) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') (e.preventDefault(), onChange(Math.min(MAXH, d.plan + 0.5)))
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') (e.preventDefault(), onChange(Math.max(0, d.plan - 0.5)))
  }
  return (
    <div className={'wk ' + (today ? 'wk-today' : '') + (d.rest ? ' wk-rest' : '')}>
      <div
        ref={col}
        className="wk-col"
        role="slider"
        tabIndex={d.rest ? -1 : 0}
        aria-label={`${d.d} planned hours`}
        aria-valuemin={0}
        aria-valuemax={MAXH}
        aria-valuenow={d.plan}
        aria-disabled={d.rest}
        onPointerDown={down}
        onPointerMove={move}
        onKeyDown={key}
      >
        {d.rest ? (
          <span className="wk-restlabel">Rest</span>
        ) : (
          <>
            <span className="wk-plan" style={{ height: (d.plan / MAXH) * 100 + '%' }}>
              <i className="wk-knob" />
            </span>
            <span className="wk-done" style={{ height: (Math.min(d.done, MAXH) / MAXH) * 100 + '%', animationDelay: i * 0.06 + 's' }} />
          </>
        )}
      </div>
      <span className="wk-d small">{d.d}</span>
      <span className="wk-h small muted num">{d.rest ? '–' : d.plan + 'h'}</span>
      <button className="wk-rest-btn small" onClick={() => onChange(d.rest ? 1 : 0, !d.rest)} aria-pressed={!!d.rest} title={d.rest ? 'Make it a work evening' : 'Make it a rest evening'}>
        {d.rest ? 'Rest' : 'Work'}
      </button>
    </div>
  )
}

function Week() {
  const [week, setWeek] = useWeek()
  const plan = week.reduce((a, d) => a + (d.rest ? 0 : d.plan), 0)
  const done = week.reduce((a, d) => a + d.done, 0)
  const rests = week.filter((d) => d.rest).length
  const ti = todayIdx()
  const change = (i, h, rest) => setWeek(week.map((d, j) => (j === i ? { ...d, plan: h, rest: rest === undefined ? d.rest : rest } : d)))
  return (
    <section className="panel">
      <header className="panel-h">
        <div>
          <h3>This week</h3>
          <span className="muted small">Drag a bar to plan hours outside office time</span>
        </div>
        <span className="wk-total">
          <b className="num"><Num value={done} decimals={1} /></b>
          <span className="muted small num">of <Num value={plan} decimals={1} /> h</span>
        </span>
      </header>
      <div className="week">
        {week.map((d, i) => (
          <DaySlider key={d.d} d={d} i={i} today={i === ti} onChange={(h, rest) => change(i, h, rest)} />
        ))}
      </div>
      <ul className="legend">
        <li><span className="sw sw-plan" />Planned</li>
        <li><span className="sw sw-done" />Done</li>
      </ul>
      <p className={'small ' + (plan > 10 ? 'c-bad' : rests === 0 ? 'c-warn' : 'muted')}>
        {plan > 10 ? `${plan} h is more than the 10 h you said is sustainable. Trim a day.` : rests === 0 ? 'No rest evening this week. Keep at least one.' : 'Missed a day? Skip it. Don’t borrow from sleep.'}
      </p>
    </section>
  )
}

function Inbox() {
  const { state, engine } = useStore()
  const [t, setT] = useState('')
  const parkable = state.registry.filter((p) => !p.self)
  return (
    <section className="panel">
      <header className="panel-h">
        <div>
          <h3>Idea inbox</h3>
          <span className="muted small">New ideas land here. They can’t jump straight to Active.</span>
        </div>
      </header>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!t.trim()) return
          engine.inbox([{ id: 'i' + Date.now(), text: t.trim(), date: new Date().toISOString().slice(0, 10) }, ...state.inbox])
          setT('')
          engine.toast('Idea saved to the inbox.', 'good')
        }}
      >
        <input id="inbox-new" value={t} onChange={(e) => setT(e.target.value)} placeholder="Capture an idea" />
        <Button icon="plus" type="submit">
          Save
        </Button>
      </form>
      <ul className="inbox">
        {state.inbox.map((i) => (
          <li key={i.id}>
            <div>
              <div>{i.text}</div>
              <span className="small muted num">{i.date}</span>
            </div>
            <select
              id={'ib-' + i.id}
              aria-label={`Attach "${i.text}" to a project`}
              value=""
              onChange={(e) => {
                const id = e.target.value
                const pl = state.plan[id]
                engine.plan(id, { ideas: [...pl.ideas, i.text] })
                engine.inbox(state.inbox.filter((x) => x.id !== i.id))
                engine.toast('Idea moved to that project’s parking lot.')
              }}
            >
              <option value="" disabled>
                Attach to…
              </option>
              {parkable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="icon-btn" aria-label={`Delete "${i.text}"`} onClick={() => engine.inbox(state.inbox.filter((x) => x.id !== i.id))}>
              <Icon name="x" />
            </button>
          </li>
        ))}
        {state.inbox.length === 0 && <li className="muted small">Inbox empty.</li>}
      </ul>
    </section>
  )
}

export default function PlanPage() {
  const { state } = useStore()
  const cols = Object.keys(PLAN_STATES)
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Plan</h1>
          <p className="muted">One active personal project. Office work sits in Committed and doesn’t count against it.</p>
        </div>
      </header>

      <ul className="rules">
        <li>Define done before building.</li>
        <li>New features go to the parking lot, not the sprint.</li>
        <li>Blocked? One session to investigate, then switch task inside the same project.</li>
        <li>A shipped v0.1 counts, even if v1.0 is far away.</li>
      </ul>

      <div className="board">
        {cols.map((c) => {
          const items = state.registry.filter((p) => state.plan[p.id].state === c)
          return (
            <section key={c} className={'col col-' + c} aria-label={PLAN_STATES[c].label}>
              <header className="col-h">
                <h2>{PLAN_STATES[c].label}</h2>
                <span className="num muted">{c === 'active' ? `${items.length} / 1` : items.length}</span>
              </header>
              <p className="small muted col-help">{PLAN_STATES[c].help}</p>
              <ul className="col-list">
                {items.map((p) => (
                  <Card key={p.id} p={p} />
                ))}
                {items.length === 0 && <li className="col-empty small muted">{c === 'active' ? 'Free slot. Promote one queued project.' : 'Nothing here.'}</li>}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="plan-bottom">
        <Week />
        <Inbox />
      </div>
    </div>
  )
}
