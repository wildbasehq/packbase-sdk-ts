import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, PackbaseError, type PackchatMessages, type PackchatStatus } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const sdk = () => new PackbaseSDK({ baseUrl: 'https://api.example.test', apiKey: 'clerk-token', autoLogin: false })

test('Packchat encodes path segments, inherits cancellation and sends management inputs explicitly', async () => {
    const requests: Array<{ url: URL; init: RequestInit }> = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        requests.push({ url: new URL(String(url)), init: init! })
        return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({})
    }) as typeof fetch
    const defaults = new AbortController().signal
    const signal = new AbortController().signal
    const chat = sdk().packs('pack/id', { signal: defaults }).packchat
    expect(requests).toHaveLength(0)
    await chat.status()
    await chat.settings()
    await chat.link({ guild_id: '18446744073709551615' })
    await chat.configure({ audience: 'public', channel_ids: ['18446744073709551614'], confirm_publish: true })
    await chat.channels()
    await chat.messages('channel/id', { before: '18446744073709551613', signal })
    await chat.unlink()
    expect(requests.map(({ url }) => url.pathname)).toEqual([
        '/pack/pack%2Fid/chat', '/pack/pack%2Fid/chat/settings', '/pack/pack%2Fid/chat/link',
        '/pack/pack%2Fid/chat/settings', '/pack/pack%2Fid/chat/channels',
        '/pack/pack%2Fid/chat/channels/channel%2Fid/messages', '/pack/pack%2Fid/chat',
    ])
    expect(requests.map(({ init }) => init.method)).toEqual(['GET', 'GET', 'POST', 'PUT', 'GET', 'GET', 'DELETE'])
    expect(requests[5]!.url.searchParams.get('before')).toBe('18446744073709551613')
    expect(requests[5]!.init.signal).toBe(signal)
    expect(requests.filter((_, index) => index !== 5).every(({ init }) => init.signal === defaults)).toBe(true)
    expect(JSON.parse(requests[2]!.init.body as string)).toEqual({ guild_id: '18446744073709551615' })
    expect(JSON.parse(requests[3]!.init.body as string)).toEqual({ audience: 'public', channel_ids: ['18446744073709551614'], confirm_publish: true })
    expect(requests[6]!.init.body).toBeUndefined()
    for (const { url, init } of requests) {
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer clerk-token')
        expect(url.search).not.toContain('clerk-token')
    }
    expect('send' in chat).toBe(false)
})

test('Fluxer account authorization uses authenticated POSTs and a bodyless disconnect', async () => {
    const requests: Array<{ url: URL; init: RequestInit }> = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        requests.push({ url: new URL(String(url)), init: init! })
        return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({})
    }) as typeof fetch
    const signal = new AbortController().signal
    const fluxer = sdk().me.connections.fluxer
    await fluxer.status({ signal })
    await fluxer.authorize({ pack_id: 'pack', guild_id: '18446744073709551615', install: true }, { signal })
    await fluxer.complete({ code: 'one-use-code', state: 'opaque-state' }, { signal })
    await fluxer.disconnect({ signal })
    expect(requests.map(({ url }) => url.pathname)).toEqual([
        '/user/me/connections/fluxer', '/user/me/connections/fluxer/authorize', '/user/me/connections/fluxer/complete', '/user/me/connections/fluxer',
    ])
    expect(requests.map(({ init }) => init.method)).toEqual(['GET', 'POST', 'POST', 'DELETE'])
    expect(JSON.parse(requests[1]!.init.body as string)).toEqual({ pack_id: 'pack', guild_id: '18446744073709551615', install: true })
    expect(JSON.parse(requests[2]!.init.body as string)).toEqual({ code: 'one-use-code', state: 'opaque-state' })
    expect(requests.every(({ url, init }) => !url.search && init.signal === signal && new Headers(init.headers).get('Authorization') === 'Bearer clerk-token')).toBe(true)
    expect(requests[3]!.init.body).toBeUndefined()
})

test('Packchat preserves authorization leases and string IDs without retaining settled chat reads', async () => {
    const message: PackchatMessages = {
        messages: [{ id: '18446744073709551615', content: 'Hello', timestamp: '2026-11-04T00:00:00.000Z', edited_timestamp: null,
            author: { id: '18446744073709551614', username: 'member', avatar_url: null }, attachments: [] }],
        has_more: false, before: null, channel_id: '18446744073709551613', generation: 'generation-1', authorization_expires_at: '2026-11-04T00:00:30.000Z',
    }
    let calls = 0
    globalThis.fetch = (async (_url: unknown) => {
        calls++
        return Response.json({ ...message, generation: `generation-${calls}` })
    }) as typeof fetch
    const chat = sdk().packs('pack').packchat
    const first = await chat.messages(message.channel_id)
    const second = await chat.messages(message.channel_id)
    expect(first).toEqual(message)
    expect(second.generation).toBe('generation-2')
    expect(calls).toBe(2)
})

test('Packchat cancellation prevents requests and authorization failures stay actionable', async () => {
    let calls = 0
    globalThis.fetch = (async (_url: unknown) => {
        calls++
        return Response.json({ code: 'PACKCHAT_ACCESS_DENIED', summary: 'Join this pack to read Packchat.' }, { status: 403 })
    }) as typeof fetch
    const signal = AbortSignal.abort()
    await expect(sdk().packs('pack', { signal }).packchat.channels()).rejects.toHaveProperty('name', 'AbortError')
    expect(calls).toBe(0)
    try {
        await sdk().packs('pack').packchat.channels()
        throw new Error('Expected authorization failure')
    } catch (error) {
        expect(error).toBeInstanceOf(PackbaseError)
        expect((error as PackbaseError).status).toBe(403)
        expect((error as PackbaseError).code).toBe('PACKCHAT_ACCESS_DENIED')
    }
})

// Keep the public status union usable without consulting bot-private metadata.
const status: PackchatStatus = { enabled: true, linked: false, status: 'unlinked', audience: 'pack_members', channel_ids: [], can_manage: true, fluxer_connected: false }
void status

test('community invite is an explicit bodyless action with inherited cancellation', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = []
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
        requests.push({ url: String(url), init })
        return Response.json({ url: 'https://fluxer.gg/community' })
    }) as typeof fetch
    const signal = new AbortController().signal
    const chat = sdk().packs('pack/id', { signal }).packchat
    expect(requests).toHaveLength(0)
    expect(await chat.invite()).toEqual({ url: 'https://fluxer.gg/community' })
    expect(requests[0]!.url).toBe('https://api.example.test/pack/pack%2Fid/chat/invite')
    expect(requests[0]!.init.method).toBe('POST')
    expect(requests[0]!.init.body).toBeUndefined()
    expect(requests[0]!.init.signal).toBe(signal)
})

test('connections discover providers and support custom authorization without SDK provider classes', async () => {
    const calls: string[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname
        calls.push(path)
        if (path === '/user/me/connections') return Response.json([{ id: 'example', method: 'custom' }])
        return Response.json({ connected: true })
    }) as typeof fetch
    try {
        const connections = sdk().me.connections
        expect((await connections.list())[0]?.id).toBe('example')
        await connections.provider('example').authorize({ token: 'private' })
        expect(calls).toEqual(['/user/me/connections', '/user/me/connections/example/authorize'])
    } finally { globalThis.fetch = original }
})
