import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK } from '../src'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('pack admission uses fresh bounded reads, encoded paths and inherited cancellation', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url, init) => {
        calls.push({ url: String(url), init })
        return Response.json({ data: [], has_more: false })
    }) as typeof fetch
    const client = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    const signal = new AbortController().signal
    const pack = client.packs('pack/name', { signal })
    await pack.access()
    await pack.joinRequests({ cursor: 'member-id' })
    await pack.requestJoin(3)
    await pack.cancelJoinRequest()
    await pack.reviewJoinRequest('user/name', true)
    expect(calls.map(call => new URL(call.url).pathname)).toEqual([
        '/pack/pack%2Fname/access', '/pack/pack%2Fname/join-requests',
        '/pack/pack%2Fname/access/request', '/pack/pack%2Fname/access/request',
        '/pack/pack%2Fname/join-requests/user%2Fname',
    ])
    expect(calls[1]?.url).toContain('cursor=member-id')
    expect(calls.map(call => call.init?.method ?? 'GET')).toEqual(['GET', 'GET', 'POST', 'DELETE', 'POST'])
    expect(calls.every(call => call.init?.signal === signal)).toBe(true)
    expect(calls[0]?.init?.cache).toBe('no-store')
    expect(calls[1]?.init?.cache).toBe('no-store')
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ rules_version: 3 })
    expect(JSON.parse(String(calls[4]?.init?.body))).toEqual({ approve: true })
})

test('visibility preview sends the proposed audience and inherits cancellation', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url, init) => {
        calls.push({ url: String(url), init })
        return Response.json({ members: 7 })
    }) as typeof fetch
    const client = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    const signal = new AbortController().signal
    expect(await client.packs('pack/name', { signal }).visibilityPreview('friends')).toEqual({ members: 7 })
    expect(calls[0]?.url).toBe('https://api.example.test/pack/pack%2Fname/visibility-preview?visibility=friends')
    expect(calls[0]?.init?.signal).toBe(signal)
    expect(calls[0]?.init?.cache).toBe('no-store')
})
