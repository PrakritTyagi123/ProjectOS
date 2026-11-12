import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useStore } from './store'
import { DEMO_ASSETS, defaultReadme } from './readmes'
import { putBlob, getBlob, delBlob, usage } from './media'
import { Icon, Button, ago } from './ui'

// README text + media list live in localStorage; the media files themselves in IndexedDB.
// Real app: the agent serves README.md and docs/media/* from the project folder.
const KEY = 'projectos-readme-v2'
const loadAll = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
const saveAll = (all) => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true } catch { return false }
}
const bytes = (n) => (n > 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i
const MAX_VIDEO = 300 * 1048576

const kindOf = (type) => (type.startsWith('video/') ? 'video' : type === 'image/gif' ? 'gif' : 'image')

// Markdown -> safe HTML. `![alt](asset:ID)` and links to .mp4/.webm become media tags.
// Media src is filled in after render (data-asset / data-src) so the sanitizer never sees blob: URLs.
function render(md, assets) {
  const byId = Object.fromEntries(assets.map((a) => [a.id, a]))
  const renderer = new marked.Renderer()
  renderer.image = (href, title, text) => {
    const alt = esc(text || '')
    const cap = title ? ` title="${esc(title)}"` : ''
    if (href?.startsWith('asset:')) {
      const a = byId[href.slice(6)]
      if (!a) return `<span class="md-missing">Missing media: ${alt || href}</span>`
      if (a.kind === 'video') return `<video data-asset="${a.id}" controls playsinline preload="metadata"${cap} aria-label="${alt}"></video>`
      return `<img data-asset="${a.id}" alt="${alt}"${cap} loading="lazy">`
    }
    if (VIDEO_EXT.test(href)) return `<video data-src="${esc(href)}" controls playsinline preload="metadata" aria-label="${alt}"></video>`
    return `<img src="${esc(href)}" alt="${alt}"${cap} loading="lazy">`
  }
  const html = marked.parse(md, { renderer, gfm: true })
  return DOMPurify.sanitize(html, { ADD_TAGS: ['video'], ADD_ATTR: ['controls', 'playsinline', 'preload', 'data-asset', 'data-src', 'loading', 'target'] })
}

// id -> object URL (or data URL for built-in demo media)
function useMediaUrls(assets) {
  const [urls, setUrls] = useState({})
  const made = useRef({})
  useEffect(() => {
    let alive = true
    ;(async () => {
      const next = {}
      for (const a of assets) {
        if (a.data) next[a.id] = a.data
        else if (made.current[a.id]) next[a.id] = made.current[a.id]
        else {
          try {
            const b = await getBlob(a.id)
            if (b) next[a.id] = made.current[a.id] = URL.createObjectURL(b)
          } catch {}
        }
      }
      if (alive) setUrls(next)
    })()
    return () => { alive = false }
  }, [assets])
  useEffect(() => () => Object.values(made.current).forEach((u) => URL.revokeObjectURL(u)), [])
  return urls
}

// Photos get shrunk; GIFs, SVGs and videos are kept as they are.
async function fileToMedia(file) {
  const id = Math.random().toString(36).slice(2, 10)
  const kind = kindOf(file.type)
  if (kind === 'video' && file.size > MAX_VIDEO) throw new Error(`${file.name} is ${bytes(file.size)}. Keep videos under ${bytes(MAX_VIDEO)}.`)
  let blob = file
  let name = file.name
  if (kind === 'image' && file.type !== 'image/svg+xml' && file.size > 400e3) {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86))
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86))
    name = file.name.replace(/\.\w+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.jpg')
  }
  await putBlob(id, blob)
  return { id, name, kind, type: blob.type || file.type, size: blob.size }
}

const TOOLS = [
  ['H', 'Heading', (s) => `## ${s || 'Heading'}`],
  ['B', 'Bold', (s) => `**${s || 'bold'}**`],
  ['I', 'Italic', (s) => `_${s || 'italic'}_`],
  ['</>', 'Code', (s) => (s.includes('\n') ? '```\n' + s + '\n```' : '`' + (s || 'code') + '`')],
  ['Link', 'Link', (s) => `[${s || 'text'}](https://)`],
  ['List', 'Bulleted list', (s) => (s || 'item').split('\n').map((l) => '- ' + l).join('\n')],
  ['Task', 'Checklist', (s) => (s || 'task').split('\n').map((l) => '- [ ] ' + l).join('\n')],
  ['Table', 'Table', () => '| Column | Column |\n|---|---|\n| Cell | Cell |'],
]
const mdFor = (a) => `![${a.name.replace(/\.\w+$/, '')}](asset:${a.id})`
const KIND_LABEL = { image: 'Image', gif: 'GIF', video: 'Video' }

function MediaThumb({ a, url }) {
  if (!url) return <div className="th-ph">Loading…</div>
  if (a.kind === 'video') return <video src={url} muted playsInline preload="metadata" onMouseEnter={(e) => e.target.play().catch(() => {})} onMouseLeave={(e) => e.target.pause()} />
  return <img src={url} alt={a.name} />
}

export default function Readme({ p }) {
  const { engine } = useStore()
  const [all, setAll] = useState(loadAll)
  const saved = all[p.id]
  const md = saved?.md ?? defaultReadme(p)
  const assets = useMemo(() => saved?.assets ?? (DEMO_ASSETS[p.id] || []).map((a) => ({ ...a, kind: 'image', type: 'image/svg+xml' })), [saved, p.id])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(md)
  const [draftAssets, setDraftAssets] = useState(assets)
  const [pane, setPane] = useState('write')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(0)
  const [quota, setQuota] = useState(null)
  const ta = useRef(null)
  const fileIn = useRef(null)
  const view = useRef(null)
  const lastSel = useRef(null)
  const remember = (e) => (lastSel.current = [e.target.selectionStart, e.target.selectionEnd])

  const curMd = editing ? draft : md
  const curAssets = editing ? draftAssets : assets
  const urls = useMediaUrls(curAssets)
  const html = useMemo(() => render(curMd, curAssets), [curMd, curAssets])
  const toc = useMemo(
    () => marked.lexer(curMd).filter((t) => t.type === 'heading' && t.depth > 1 && t.depth < 4).map((t) => ({ depth: t.depth, text: t.text.replace(/[*_`]/g, ''), id: slug(t.text) })),
    [curMd]
  )

  useEffect(() => {
    usage().then(setQuota)
  }, [all, draftAssets])

  // Fill media sources, heading ids and link targets after each render.
  useEffect(() => {
    const root = view.current
    if (!root) return
    root.querySelectorAll('[data-asset]').forEach((el) => {
      const u = urls[el.dataset.asset]
      if (u && el.getAttribute('src') !== u) el.setAttribute('src', u)
    })
    root.querySelectorAll('[data-src]').forEach((el) => el.getAttribute('src') || el.setAttribute('src', el.dataset.src))
    root.querySelectorAll('h1,h2,h3').forEach((h) => (h.id = 'md-' + slug(h.textContent)))
    root.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
    })
  }, [html, urls, editing, pane])

  const startEdit = () => {
    setDraft(md)
    setDraftAssets(assets)
    setEditing(true)
    setPane('write')
    lastSel.current = null
  }
  const cancel = () => {
    // Drop media uploaded during this edit.
    const keep = new Set(assets.map((a) => a.id))
    draftAssets.filter((a) => !keep.has(a.id) && !a.data).forEach((a) => delBlob(a.id))
    setEditing(false)
  }
  const save = () => {
    const next = { ...all, [p.id]: { md: draft, assets: draftAssets, updated: Date.now() } }
    if (!saveAll(next)) return engine.toast('Couldn’t save. Browser storage is full or blocked.', 'bad')
    const keep = new Set(draftAssets.map((a) => a.id))
    assets.filter((a) => !keep.has(a.id) && !a.data).forEach((a) => delBlob(a.id))
    setAll(next)
    setEditing(false)
    engine.toast('README saved.', 'good')
  }
  const resetDefault = () => {
    assets.filter((a) => !a.data).forEach((a) => delBlob(a.id))
    const next = { ...all }
    delete next[p.id]
    saveAll(next)
    setAll(next)
    setEditing(false)
    engine.toast('README reset to the demo version.')
  }

  const insert = (fn) => {
    const el = ta.current
    const value = el ? el.value : draft
    // Use the last caret position in the editor; if it was never placed, add at the end.
    const sel = lastSel.current || [value.length, value.length]
    const [a, b] = [Math.min(sel[0], value.length), Math.min(sel[1], value.length)]
    let text = fn(value.slice(a, b))
    const block = text.includes('\n') || text.startsWith('![') || /^(#|\||- )/.test(text)
    const before = value.slice(0, a)
    const after = value.slice(b)
    const pre = !block || before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const post = !block || after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const v = before + pre + text + post + after
    const caret = a + pre.length + text.length
    lastSel.current = [caret, caret]
    setDraft(v)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = caret
    })
  }

  const addFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (!list.length) return engine.toast('Only images, GIFs and videos can be attached.', 'bad')
    setBusy((n) => n + list.length)
    const made = []
    for (const f of list) {
      try {
        made.push(await fileToMedia(f))
      } catch (e) {
        engine.toast(e.message?.includes('Keep videos') ? e.message : `${f.name} couldn’t be added. Storage may be full.`, 'bad')
      } finally {
        setBusy((n) => n - 1)
      }
    }
    if (!made.length) return
    setDraftAssets((x) => [...x, ...made])
    insert(() => made.map(mdFor).join('\n\n'))
    const kinds = [...new Set(made.map((m) => KIND_LABEL[m.kind].toLowerCase()))].join(' and ')
    engine.toast(`Added ${made.length} ${made.length > 1 ? 'files' : kinds}.`, 'good')
  }

  const removeAsset = (id) => {
    setDraftAssets((x) => x.filter((a) => a.id !== id))
    setDraft((d) => d.replace(new RegExp(`!\\[[^\\]]*\\]\\(asset:${id}\\)\\n?`, 'g'), ''))
  }

  const jump = (id) => document.getElementById('md-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const article = <article className="md" ref={view} dangerouslySetInnerHTML={{ __html: html }} />

  return (
    <div className="readme">
      <section className="panel rd-file">
        <header className="rd-bar">
          <div className="rd-name">
            <Icon name="doc" />
            <b>README.md</b>
            <span className="muted small">{saved?.updated ? `Edited ${ago(saved.updated)}` : 'Demo content'}</span>
          </div>
          {editing ? (
            <div className="ctl">
              <Button onClick={cancel}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={save} disabled={busy > 0}>
                {busy ? 'Adding media…' : 'Save README'}
              </Button>
            </div>
          ) : (
            <Button icon="edit" onClick={startEdit}>
              Edit
            </Button>
          )}
        </header>

        {editing ? (
          <div className="rd-edit">
            <div className="rd-tools">
              <div className="seg rd-pane" role="tablist" aria-label="Editor view">
                {['write', 'split', 'preview'].map((k) => (
                  <button key={k} role="tab" aria-selected={pane === k} className={(pane === k ? 'on ' : '') + (k === 'split' ? 'split-only' : '')} onClick={() => setPane(k)}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
              <div className="rd-fmt" role="toolbar" aria-label="Formatting">
                {TOOLS.map(([label, title, fn]) => (
                  <button key={title} title={title} aria-label={title} onClick={() => insert(fn)} disabled={pane === 'preview'}>
                    {label}
                  </button>
                ))}
                <button className="rd-img" title="Add images, GIFs or videos" onClick={() => fileIn.current.click()}>
                  <Icon name="image" /> Media
                </button>
                <input ref={fileIn} id="rd-file" type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
              </div>
            </div>
            <div className={'rd-split rd-' + pane}>
              {pane !== 'preview' && (
                <div
                  className={'rd-write ' + (drag ? 'drag' : '')}
                  onDragOver={(e) => (e.preventDefault(), setDrag(true))}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => (e.preventDefault(), setDrag(false), addFiles(e.dataTransfer.files))}
                >
                  <textarea
                    ref={ta}
                    id={'rd-' + p.id}
                    value={draft}
                    onChange={(e) => (setDraft(e.target.value), remember(e))}
                    onSelect={remember}
                    onPaste={(e) => {
                      const f = [...e.clipboardData.files]
                      if (f.length) {
                        e.preventDefault()
                        addFiles(f)
                      }
                    }}
                    spellCheck="false"
                    aria-label="README markdown"
                  />
                  <div className="rd-hint small">
                    {busy ? `Adding ${busy} file${busy > 1 ? 's' : ''}…` : 'Markdown. Drop, paste or pick images, GIFs and videos. A link ending in .mp4 or .webm also plays as video.'}
                  </div>
                  {drag && <div className="rd-drop">Drop images, GIFs or videos</div>}
                </div>
              )}
              {pane !== 'write' && article}
            </div>
          </div>
        ) : (
          article
        )}
      </section>

      <aside className="rd-side">
        {toc.length > 0 && (
          <section className="panel">
            <h3>On this page</h3>
            <ul className="toc">
              {toc.map((t, i) => (
                <li key={i} className={'toc-' + t.depth}>
                  <button onClick={() => jump(t.id)}>{t.text}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="panel">
          <header className="panel-h">
            <h3>Media</h3>
            <span className="muted small num">{curAssets.length}</span>
          </header>
          {curAssets.length ? (
            <ul className="thumbs">
              {curAssets.map((a) => (
                <li key={a.id}>
                  <div className="th-box">
                    <MediaThumb a={a} url={urls[a.id]} />
                    <span className={'th-kind th-' + a.kind}>{KIND_LABEL[a.kind]}</span>
                  </div>
                  <div className="th-meta">
                    <span className="small th-name">{a.name}</span>
                    <span className="muted small num">{bytes(a.size)}</span>
                  </div>
                  {editing && (
                    <div className="th-act">
                      <button className="link small" onClick={() => insert(() => mdFor(a))}>
                        Insert
                      </button>
                      <button className="link small th-del" onClick={() => removeAsset(a.id)}>
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{editing ? 'Drop images, GIFs or videos on the editor.' : 'No media yet. Choose Edit to add some.'}</p>
          )}
        </section>
        <section className="panel rd-note">
          <p className="small muted">
            Demo: README text and media are saved in this browser{quota ? ` (${bytes(quota.used)} used of ${bytes(quota.quota)})` : ''}. Videos up to {bytes(MAX_VIDEO)} each. In the real app the agent reads <code>README.md</code> and <code>docs/media</code> from <code>{p.cwd}</code>.
          </p>
          {saved && (
            <button className="link small" onClick={resetDefault}>
              Reset to demo README
            </button>
          )}
        </section>
      </aside>
    </div>
  )
}
