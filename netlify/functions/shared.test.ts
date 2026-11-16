import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem = new Map<string, unknown>()
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    list: async ({ prefix }: { prefix: string }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
    get: async (key: string) => mem.get(key) ?? null,
    setJSON: async (key: string, v: unknown) => void mem.set(key, v),
    delete: async (key: string) => void mem.delete(key),
  }),
}))

const { default: handler } = await import('./shared.mts')
const req = (method: string, body?: unknown, pass = 'pw') =>
  new Request('http://x/api/shared', { method, headers: { 'x-passcode': pass, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })

describe('shared library function', () => {
  beforeEach(() => {
    mem.clear()
    process.env.APP_PASSCODE = 'pw'
  })

  it('rejects a wrong passcode', async () => {
    expect((await handler(req('GET', undefined, 'nope'))).status).toBe(401)
  })

  it('stores, lists and deletes items by kind', async () => {
    await handler(req('POST', { kind: 'labels', items: [{ id: 'a', name: 'Classico' }, { id: 'b', name: 'Rao' }] }))
    await handler(req('POST', { kind: 'workouts', items: [{ id: 'w1|x', name: 'Upper A' }] }))
    let data = await (await handler(req('GET'))).json()
    expect(data.labels).toHaveLength(2)
    expect(data.workouts[0].name).toBe('Upper A')
    await handler(req('DELETE', { kind: 'labels', id: 'a' }))
    data = await (await handler(req('GET'))).json()
    expect(data.labels.map((l: { id: string }) => l.id)).toEqual(['b'])
  })

  it('ignores bad kinds and ids', async () => {
    expect((await handler(req('POST', { kind: 'secrets', items: [] }))).status).toBe(400)
    const r = await (await handler(req('POST', { kind: 'labels', items: [{ id: '../../etc', name: 'x' }] }))).json()
    expect(r.saved).toBe(0)
  })
})
