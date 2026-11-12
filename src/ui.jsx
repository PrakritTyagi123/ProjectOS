import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PLAN_STATES } from './data'
import { useLogo } from './logos'

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
  more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  bell: 'M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1.5H3zM6.5 13.5a1.5 1.5 0 0 0 3 0',
  git: 'M5 3v10M5 13a1.5 1.5 0 1 0 0-.01M11 5.5a1.5 1.5 0 1 0 0-.01M11 7c0 2.5-6 2-6 4.5',
  cloud: 'M4.5 12.5h7a3 3 0 0 0 .3-6 4 4 0 0 0-7.6 1.1A2.5 2.5 0 0 0 4.5 12.5z',
  game: 'M4 5.5h8a2.5 2.5 0 0 1 2.4 3.2l-.8 2.8a1.5 1.5 0 0 1-2.6.5L9.6 10.5H6.4L5 12a1.5 1.5 0 0 1-2.6-.5l-.8-2.8A2.5 2.5 0 0 1 4 5.5zM5 7.5v2M4 8.5h2M10.5 8h.01M11.8 9.2h.01',
  chip: 'M4.5 4.5h7v7h-7zM6.5 2v2.5M9.5 2v2.5M6.5 11.5V14M9.5 11.5V14M2 6.5h2.5M2 9.5h2.5M11.5 6.5H14M11.5 9.5H14',
  chev: 'M6 4l4 4-4 4',
  chevd: 'M4 6l4 4 4-4',
  sidebar: 'M2 2.5h12v11H2zM6 2.5v11',
  rows: 'M2.5 3.5h11M2.5 8h11M2.5 12.5h11',
  folder: 'M1.5 4v8.5h13V5.5H7.5L6 4z',
  pulse: 'M1.5 8h3l1.5-4 3 8 1.5-4h4',
  logs: 'M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3',
  cog: 'M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
  clock: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.5',
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
  const logo = useLogo(p.id)
  const initials = p.name
    .replace(/[^A-Za-z0-9 -]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span className={'glyph' + (logo ? ' glyph-img' : '')} style={{ '--h': p.hue, width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {logo ? <img src={logo} alt="" /> : initials}
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

// Small, consistent status indicator: dot + label.
export function Status({ status, label, sub }) {
  const s = STATUS[status]
  return (
    <span className={'status status-' + s.tone}>
      <Led status={status} />
      <span>{label || s.label}</span>
      {sub && <span className="status-sub">{sub}</span>}
    </span>
  )
}

// Popover menu. Closes on outside click and Escape.
export function Menu({ label = 'More actions', items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const key = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', off)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', off)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button className="btn btn-icon btn-sm" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => (e.stopPropagation(), setOpen(!open))}>
        <Icon name="more" />
      </button>
      {open && (
        <div className={'menu-pop menu-' + align} role="menu">
          {items.filter(Boolean).map((it, i) =>
            it === '-' ? (
              <hr key={i} />
            ) : it.head ? (
              <div key={i} className="menu-head">{it.head}</div>
            ) : (
              <button
                key={i}
                role="menuitem"
                className={'menu-item ' + (it.danger ? 'menu-danger' : '')}
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  it.onClick()
                }}
              >
                {it.icon && <Icon name={it.icon} />}
                <span>{it.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// Neumorphic select: raised button + raised listbox. Keyboard: arrows, Enter, Escape, type-ahead.
export function Select({ id, value, onChange, options, label, small, disabled, ariaLabel, placeholder }) {
  const opts = options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : typeof o === 'string' ? { value: o, label: o } : o))
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef(null)
  const cur = opts.find((o) => o.value === value)
  useEffect(() => {
    if (!open) return
    setHi(Math.max(0, opts.findIndex((o) => o.value === value)))
    const off = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])
  const pick = (o) => {
    if (o.disabled) return
    setOpen(false)
    if (o.value !== value) onChange(o.value)
  }
  const key = (e) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), open ? setHi(Math.min(opts.length - 1, hi + 1)) : setOpen(true))
    else if (e.key === 'ArrowUp') (e.preventDefault(), open ? setHi(Math.max(0, hi - 1)) : setOpen(true))
    else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), open ? pick(opts[hi]) : setOpen(true))
    else if (e.key === 'Escape') setOpen(false)
    else if (e.key.length === 1) {
      const i = opts.findIndex((o) => String(o.label).toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setHi(i)
    }
  }
  const btn = (
    <div className={'nsel ' + (small ? 'nsel-sm ' : '') + (open ? 'is-open' : '')} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button id={id} type="button" className="nsel-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel || label} onClick={() => setOpen(!open)} onKeyDown={key}>
        <span className="nsel-v">{cur ? cur.label : placeholder || 'Choose'}</span>
        <Icon name="chevd" size={12} />
      </button>
      {open && (
        <ul className="nsel-pop" role="listbox" aria-label={ariaLabel || label}>
          {opts.map((o, i) => (
            <li
              key={String(o.value)}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={(i === hi ? 'hi ' : '') + (o.value === value ? 'cur ' : '') + (o.disabled ? 'dis' : '')}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(o)}
            >
              <span>{o.label}</span>
              {o.value === value && <Icon name="check" size={12} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
  if (!label) return btn
  return (
    <div className="sel">
      <span>{label}</span>
      {btn}
    </div>
  )
}

// Empty state: icon well, one line, one action.
export function EmptyState({ icon = 'check', title, text, action }) {
  return (
    <div className="empty-state">
      <span className="es-icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <b>{title}</b>
        {text && <p className="small muted">{text}</p>}
      </div>
      {action}
    </div>
  )
}

// Skeleton blocks shown while the agent answers.
export function Skeleton({ lines = 3, h = 14, block }) {
  if (block) return <div className="sk sk-block" style={{ height: block }} />
  return (
    <div className="sk-lines">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="sk" style={{ height: h, width: `${90 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  )
}

// FLIP: children with data-flip keys slide to their new position after a re-order.
export function useFlip(ref, key) {
  const prev = useRef(new Map())
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const els = root.querySelectorAll('[data-flip]')
    const next = new Map()
    els.forEach((el) => {
      const r = el.getBoundingClientRect()
      next.set(el.dataset.flip, r.top)
      const old = prev.current.get(el.dataset.flip)
      if (old != null && Math.abs(old - r.top) > 2 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.animate([{ transform: `translateY(${old - r.top}px)` }, { transform: 'translateY(0)' }], { duration: 450, easing: 'cubic-bezier(.3,.8,.3,1)' })
      }
    })
    prev.current = next
  }, [key])
}

// Line chart with axis, grid and end marker. data: [{t, v}] ; max fixed.
export function HistoryChart({ series, max = 100, unit = '%', height = 240, fmtT }) {
  const W = 1000
  const H = height
  const pad = { l: 34, r: 12, t: 12, b: 24 }
  const n = series[0].data.length
  const x = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r)
  const y = (v) => pad.t + (1 - Math.min(v, max) / max) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max)
  const xt = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]
  return (
    <svg className="hchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(', ') + ' history'}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="hc-grid" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="hc-tx">{Math.round(t)}{unit === '%' ? '' : ''}</text>
        </g>
      ))}
      {xt.map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="hc-tx">{fmtT(series[0].data[i].t)}</text>
      ))}
      {series.map((s, si) => {
        const d = s.data.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ')
        const last = s.data[n - 1]
        return (
          <g key={s.name} className={'hc-s hc-s' + si}>
            {si === 0 && <path d={d + ` L ${x(n - 1)} ${H - pad.b} L ${x(0)} ${H - pad.b} Z`} className="hc-fill" />}
            <path d={d} className="hc-line" />
            <circle cx={x(n - 1)} cy={y(last.v)} r="3.5" className="hc-end" />
          </g>
        )
      })}
    </svg>
  )
}
