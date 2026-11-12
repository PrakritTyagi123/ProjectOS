// Media blobs (images, GIFs, videos) for README demo storage.
// IndexedDB holds hundreds of MB; localStorage only holds ~5 MB.
const DB = 'projectos-media'
const STORE = 'blobs'
let dbp = null

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      } catch (e) {
        reject(e)
      }
    })
  }
  return dbp
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const r = fn(t.objectStore(STORE))
        t.oncomplete = () => resolve(r?.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
  )
}

export const putBlob = (id, blob) => tx('readwrite', (s) => s.put(blob, id))
export const getBlob = (id) => tx('readonly', (s) => s.get(id))
export const delBlob = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {})

export async function usage() {
  try {
    const e = await navigator.storage.estimate()
    return { used: e.usage || 0, quota: e.quota || 0 }
  } catch {
    return null
  }
}
