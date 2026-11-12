import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PLAN_STATES } from './data'

// ── formatting ───────────────────────────────────────────────
export const clock = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}
export const uptime = (t) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s % 60}s`
  return `${s}s`
}
export const gb = (v) => `${v.toFixed(1)} GB`

// Re-render every second for live uptime counters.
export function useNow(ms = 1000) {
  const [, set] = useState(0)
  useEffect(() => {
    const i = setInterval(() => set((x) => x + 1), ms)
    return () => clearInterval(i)
  }, [ms])
}

// ── icons (stroke, 16px grid) ────────────────────────────────
const paths = {
  play: 'M5 3.5v9l7.5-4.5z',
  stop: 'M4.5 4.5h7v7h-7z',
  restart: 'M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8',
  open: 'M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6 14 14',
  plus: 'M8 3v10M3 8h10',
  back: 'M10 3 5 8l5 5',
  grid: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  flag: 'M3.5 14V2.5M3.5 3h8l-1.8 3 1.8 3h-8',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  x: 'M4 4l8 8M12 4l-8 8',
  check: 'M3 8.5l3.2 3L13 4.5',
  warn: 'M8 2 1.8 13h12.4zM8 6.5v3M8 11.5h.01',
  copy: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  bolt: 'M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z',
  menu: 'M2.5 4h11M2.5 8h11M2.5 12h11',
  doc: 'M4 1.5h5.5L12.5 4.5V14.5H4zM9.5 1.5v3h3M6 8h4.5M6 10.5h4.5',
  edit: 'M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3',
  image: 'M2 3h12v10H2zM2 11l3.5-3.5 3 3 2-2L14 12M10.5 6.2h.01',
  sun: 'M8 10.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9',
  moon: 'M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z',
  auto: 'M2.5 3.5h11v7.5h-11zM6 14h4M8 11v3',
}
export function Icon({ name, size = 16, className = '' }) {
  return (
    <svg className={'icon ' + className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} fill={name === 'play' || name === 'stop' || name === 'bolt' ? 'currentColor' : 'none'} />
    </svg>
  )
}

// ── status ──────────────────────────────────────────────────
export const STATUS = {
  running: { label: 'Running', tone: 'good' },
  starting: { label: 'Starting', tone: 'busy' },
  stopping: { label: 'Stopping', tone: 'busy' },
  stopped: { label: 'Stopped', tone: 'idle' },
  failed: { label: 'Failed', tone: 'bad' },
  unhealthy: { label: 'Unhealthy', tone: 'warn' },
  offline: { label: 'Machine offline', tone: 'off' },
}
export function StatusPill({ status, small }) {
  const s = STATUS[status]
  return (
    <span className={`pill pill-${s.tone} ${small ? 'pill-sm' : ''}`}>
      <span className="dot" />
      {s.label}
    </span>
  )
}

export function PlanChip({ state }) {
  return <span className={`plan-chip plan-${state}`}>{PLAN_STATES[state].label}</span>
}

export function Glyph({ p, size = 36 }) {
  const initials = p.name
    .replace(/[^A-Za-z0-9 -]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span className="glyph" style={{ '--h': p.hue, width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials}
    </span>
  )
}

export function Sparkline({ data, max = 100, height = 34, className = '' }) {
  const w = 120
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 2 - (Math.min(v, max) / max) * (height - 4)])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg className={'spark ' + className} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={w} y1={height / 2} y2={height / 2} className="spark-grid" />
      <path d={d + ` L ${w} ${height} L 0 ${height} Z`} className="spark-fill" />
      <path d={d} className="spark-line" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.2" className="spark-end" />
    </svg>
  )
}

export function Bar({ value, max, tone = 'accent' }) {
  return (
    <div className="bar" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span className={`bar-fill bar-${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

export function Button({ icon, children, variant = 'default', ...rest }) {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal ' + (wide ? 'modal-wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── v2 visual pieces ─────────────────────────────────────────
export const catVar = (c) => `var(--c-${c})`

// Count-up number. Tweens from the previous value.
export function Num({ value, decimals = 0, ms = 700 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    const b = value
    if (a === b) return
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const v = a + (b - a) * e
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      from.current = b
    }
  }, [value, ms])
  return <>{Number(shown).toFixed(decimals)}</>
}

// Sliding pressed/raised indicator behind the `.on` child of its parent.
export function Knob({ variant = 'out' }) {
  const ref = useRef(null)
  const place = () => {
    const k = ref.current
    if (!k) return
    const on = k.parentElement.querySelector(':scope > .on')
    if (!on) return (k.style.opacity = '0')
    k.style.opacity = '1'
    k.style.width = on.offsetWidth + 'px'
    k.style.height = on.offsetHeight + 'px'
    k.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`
    if (!k.dataset.ready) requestAnimationFrame(() => k && (k.dataset.ready = '1'))
  }
  useLayoutEffect(place)
  useEffect(() => {
    window.addEventListener('resize', place)
    const t = setTimeout(place, 300) // after web fonts settle
    return () => {
      window.removeEventListener('resize', place)
      clearTimeout(t)
    }
  }, [])
  return <span ref={ref} className={'knob knob-' + variant} aria-hidden="true" />
}

// Neumorphic dial: inset groove, raised centre disc, needle on the rim, tick marks.
const TICKS = Array.from({ length: 28 }, (_, i) => -135 + (270 / 27) * i)
export function Gauge({ value, max = 100, label, unit = '%', color = 'var(--accent)' }) {
  const r = 39
  const C = 2 * Math.PI * r
  const sweep = C * 0.75
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <div className="gauge" style={{ '--g': color }}>
      <div className="dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {TICKS.map((d, i) => (
            <line key={i} x1="50" y1="3.5" x2="50" y2={i % 9 === 0 ? 8.5 : 6.5} className={'tick' + ((i / 27) <= pct + 0.001 ? ' tick-on' : '')} transform={`rotate(${d} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r={r} className="g-track" strokeDasharray={`${sweep} ${C}`} transform="rotate(135 50 50)" />
          <circle cx="50" cy="50" r={r} className="g-val" strokeDasharray={`${sweep * pct} ${C}`} transform="rotate(135 50 50)" />
        </svg>
        <div className="dial-needle" style={{ transform: `rotate(${-135 + 270 * pct}deg)` }}>
          <i />
        </div>
        <div className="dial-disc">
          <b className="num">
            <Num value={value} decimals={unit === '%' ? 0 : 1} />
          </b>
          <span>{unit === '%' ? '%' : `of ${max} GB`}</span>
        </div>
      </div>
      <div className="g-label">{label}</div>
    </div>
  )
}

// Progress ring used for definition-of-done.
export function Ring({ done, total, size = 96 }) {
  const r = 40
  const C = 2 * Math.PI * r
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 96 96" aria-label={`${done} of ${total} done`}>
      <defs>
        <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hot)" />
          <stop offset="0.5" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--c-web)" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r={r} className="ring-track" />
      <circle cx="48" cy="48" r={r} className="ring-val" strokeDasharray={`${(C * done) / Math.max(1, total)} ${C}`} transform="rotate(-90 48 48)" />
      <text x="48" y="47" textAnchor="middle" className="ring-n"><Num value={done} /></text>
      <text x="48" y="64" textAnchor="middle" className="ring-of">of {total}</text>
    </svg>
  )
}

// Heartbeat trace. Beats while alive, flat when not.
const BEAT = (o) => `H${o + 22} L${o + 26} 14 L${o + 30} 20 H${o + 36} L${o + 40} 4 L${o + 45} 34 L${o + 49} 20 H${o + 56} L${o + 60} 16 L${o + 64} 20 H${o + 100}`
export function Heartbeat({ alive, tone = 'good', height = 40 }) {
  const d = alive ? `M0 20 ${BEAT(0)} ${BEAT(100)}` : 'M0 20 H200'
  return (
    <div className={'hb hb-' + tone + (alive ? ' hb-alive' : '')} style={{ height }}>
      <svg viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d={d} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

export function Led({ status }) {
  return <span className={'led led-' + (STATUS[status]?.tone || 'idle')} aria-hidden="true" />
}

// Live bars (per-project CPU history).
export function LiveBars({ data, color }) {
  const max = Math.max(20, ...data)
  return (
    <div className="lbars" style={{ '--c': color }} aria-hidden="true">
      {data.map((v, i) => (
        <span key={i} style={{ height: Math.max(4, (v / max) * 100) + '%' }} />
      ))}
    </div>
  )
}
