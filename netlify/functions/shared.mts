// Shared library for everyone using this app: nutrition labels, custom exercises and
// workout lineups. Personal data (history, weights, food log) never comes here.
// GET  /api/shared                → { labels, exercises, workouts }
// POST /api/shared  { kind, items } → upsert items
// DELETE /api/shared { kind, id }   → remove one item
// Header x-passcode must match APP_PASSCODE. Storage: Netlify Blobs (store "shared-library").
import { getStore } from '@netlify/blobs'

export const config = { path: '/api/shared' }

export const KINDS = ['labels', 'exercises', 'workouts'] as const
type Kind = (typeof KINDS)[number]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const isKind = (k: unknown): k is Kind => typeof k === 'string' && (KINDS as readonly string[]).includes(k)
const safeId = (id: unknown): id is string => typeof id === 'string' && /^[\w~|:.-]{1,400}$/.test(id)

export default async (req: Request) => {
  if (!process.env.APP_PASSCODE) return json({ error: 'Sharing is not set up yet (missing passcode on Netlify).' }, 503)
  if (req.headers.get('x-passcode') !== process.env.APP_PASSCODE) return json({ error: 'Wrong passcode. Check Settings → Photo & link reader.' }, 401)
  const store = getStore('shared-library')

  if (req.method === 'GET') {
    const out: Record<Kind, unknown[]> = { labels: [], exercises: [], workouts: [] }
    await Promise.all(
      KINDS.map(async (kind) => {
        const { blobs } = await store.list({ prefix: `${kind}/` })
        const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)))
        out[kind] = items.filter(Boolean)
      }),
    )
    return json(out)
  }

  let body: { kind?: unknown; items?: unknown; id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  if (!isKind(body.kind)) return json({ error: 'Unknown kind.' }, 400)

  if (req.method === 'POST') {
    if (!Array.isArray(body.items) || body.items.length > 200) return json({ error: 'Send 1–200 items.' }, 400)
    let saved = 0
    for (const item of body.items) {
      const id = (item as { id?: unknown })?.id
      if (!safeId(id) || JSON.stringify(item).length > 30_000) continue
      await store.setJSON(`${body.kind}/${id}`, item)
      saved++
    }
    return json({ saved })
  }

  if (req.method === 'DELETE') {
    if (!safeId(body.id)) return json({ error: 'Bad id.' }, 400)
    await store.delete(`${body.kind}/${body.id}`)
    return json({ ok: true })
  }

  return json({ error: 'Use GET, POST or DELETE.' }, 405)
}
