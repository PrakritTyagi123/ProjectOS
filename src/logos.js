// Per-project icons uploaded by the user. Blob in IndexedDB, presence list in localStorage.
import { useEffect, useState } from 'react'
import { putBlob, getBlob, delBlob } from './media'

const KEY = 'projectos-logos'
const EVT = 'projectos-logos'
const urls = {}
const list = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
const saveList = (l) => {
  try { localStorage.setItem(KEY, JSON.stringify(l)) } catch {}
  window.dispatchEvent(new Event(EVT))
}

export function useLogo(id) {
  const [url, setUrl] = useState(urls[id] || null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!list().includes(id)) return alive && setUrl(null)
      if (urls[id]) return alive && setUrl(urls[id])
      try {
        const b = await getBlob('logo-' + id)
        if (b && alive) setUrl((urls[id] = URL.createObjectURL(b)))
      } catch {}
    }
    load()
    window.addEventListener(EVT, load)
    return () => {
      alive = false
      window.removeEventListener(EVT, load)
    }
  }, [id])
  return url
}

export async function setLogo(id, file) {
  // Square-crop and shrink to 128px so icons stay tiny.
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = c.height = 128
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 128, 128)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  await putBlob('logo-' + id, blob)
  if (urls[id]) URL.revokeObjectURL(urls[id])
  delete urls[id]
  saveList([...new Set([...list(), id])])
}

export async function clearLogo(id) {
  await delBlob('logo-' + id)
  if (urls[id]) URL.revokeObjectURL(urls[id])
  delete urls[id]
  saveList(list().filter((x) => x !== id))
}
