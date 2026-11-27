import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('default Pack reads bypass cache and writes carry the selected ID and cancellation', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url, init) => {
        calls.push({ url: String(url), init })
        return Response.json(init?.method === 'PATCH' ? {} : { id: 'owned-pack' })
    }) as typeof fetch
    const client = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    const signal = new AbortController().signal
    expect(await client.packs.getDefault({ signal })).toEqual({ id: 'owned-pack' })
    await client.packs.getDefault({ signal })
    await client.packs.setDefault('another-pack', { signal })
    expect(calls).toHaveLength(3)
    expect(calls.every(call => call.url.endsWith('/packs/default'))).toBe(true)
    expect(calls[2]?.init?.method).toBe('PATCH')
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ pack_id: 'another-pack' })
    expect(calls[2]?.init?.signal).toBe(signal)
})

test('an account with no default normalizes the API omitted null ID', async () => {
    globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch
    const client = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    expect(await client.packs.getDefault()).toEqual({ id: null })
})
