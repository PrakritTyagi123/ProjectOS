// Cloudflare Pages Function: same-origin /api/* -> ProjectOS agent through the tunnel.
//
// The dashboard (and this function) sit behind a Cloudflare Access app for your email.
// The agent hostname sits behind a second Access app that only admits the service token below.
// The browser never sees the token and never talks to the tunnel directly.
//
// Pages > Settings > Environment variables (encrypt the secret):
//   AGENT_URL               https://agent.YOURDOMAIN
//   CF_ACCESS_CLIENT_ID     <service token client id>
//   CF_ACCESS_CLIENT_SECRET <service token client secret>   (encrypted)

const ALLOWED = [
  ['GET', /^\/api\/agent$/],
  ['GET', /^\/api\/projects$/],
  ['GET', /^\/api\/projects\/[a-z0-9-]+$/],
  ['POST', /^\/api\/projects\/[a-z0-9-]+\/(start|stop|restart)$/],
  ['GET', /^\/api\/projects\/[a-z0-9-]+\/(logs|readme)$/],
  ['GET', /^\/api\/projects\/[a-z0-9-]+\/media\/[\w\-./ %]+$/],
  ['GET', /^\/api\/host\/metrics$/],
  ['GET', /^\/api\/activity$/],
]

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function onRequest({ request, env }) {
  const url = new URL(request.url)
  const ok = ALLOWED.some(([m, rx]) => m === request.method && rx.test(url.pathname))
  if (!ok) return json(405, { detail: 'Not an allowed ProjectOS call' })
  if (!env.AGENT_URL || !env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET) return json(500, { detail: 'Pages env vars AGENT_URL, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET are not set' })

  // Basic CSRF guard: state-changing calls must come from this same site.
  if (request.method === 'POST') {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== url.host) return json(403, { detail: 'Cross-site request refused' })
  }

  const target = new URL(env.AGENT_URL)
  target.pathname = url.pathname
  target.search = url.search

  const headers = new Headers()
  for (const h of ['content-type', 'accept', 'range']) {
    const v = request.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set('CF-Access-Client-Id', env.CF_ACCESS_CLIENT_ID)
  headers.set('CF-Access-Client-Secret', env.CF_ACCESS_CLIENT_SECRET)
  // Who did it, for the agent's audit log. Set by Access on requests to this Pages site.
  const email = request.headers.get('cf-access-authenticated-user-email')
  if (email) headers.set('X-ProjectOS-User', email)
  const ua = request.headers.get('user-agent') || ''
  headers.set('X-ProjectOS-Device', /Android|iPhone|iPad/i.test(ua) ? 'Phone' : 'Browser')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(target, { method: request.method, headers, body: request.method === 'POST' ? await request.text() : undefined, signal: ctrl.signal, redirect: 'manual' })
    // Access answers a bad/missing token with a redirect to its login page.
    if (res.status >= 300 && res.status < 400) return json(502, { detail: 'Agent hostname rejected the service token (check the Access policy on the agent app)' })
    const out = new Headers(res.headers)
    out.set('cache-control', 'no-store')
    out.delete('set-cookie')
    return new Response(res.body, { status: res.status, headers: out })
  } catch (e) {
    return json(503, { detail: 'Agent unreachable. The PC may be asleep or offline.', agentOffline: true })
  } finally {
    clearTimeout(timer)
  }
}
