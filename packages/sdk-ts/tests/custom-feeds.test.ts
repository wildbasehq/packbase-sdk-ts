import { afterEach, describe, expect, test } from 'bun:test'
import { BUILTIN_PARTIALS, PackbaseSDK, TEMPLATE_HELPERS } from '../src'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

function recordCalls() {
    const calls: { method: string; path: string; body: unknown }[] = []
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        calls.push({
            method: init?.method ?? 'GET',
            path: new URL(String(input)).pathname,
            body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
        })
        return init?.method === 'POST' || init?.method === 'PATCH'
            ? Response.json({ id: 'x' }, { status: init.method === 'POST' ? 201 : 200 })
            : new Response(null, { status: 204 })
    }) as typeof fetch
    return {
        calls,
        pb: new PackbaseSDK({ baseUrl: 'https://api.example.test', apiKey: 'session', autoLogin: false }),
    }
}

describe('customFeeds', () => {
    test('pin issues PUT /feeds/custom/:id/pin', async () => {
        const { calls, pb } = recordCalls()
        await pb.customFeeds.pin('x')
        expect(calls).toEqual([{ method: 'PUT', path: '/feeds/custom/x/pin', body: undefined }])
    })

    test('write methods use the custom feed routes', async () => {
        const { calls, pb } = recordCalls()
        await pb.customFeeds.create({ display_name: 'Art', description: 'Image howls' })
        await pb.customFeeds.update('x', { listed: false })
        await pb.customFeeds.unpin('x')
        await pb.customFeeds.reorder(['b', 'a'])
        await pb.customFeeds.delete('a/b')
        expect(calls).toEqual([
            { method: 'POST', path: '/feeds/custom', body: { display_name: 'Art', description: 'Image howls' } },
            { method: 'PATCH', path: '/feeds/custom/x', body: { listed: false } },
            { method: 'DELETE', path: '/feeds/custom/x/pin', body: undefined },
            { method: 'PUT', path: '/feeds/custom/pins/order', body: { ids: ['b', 'a'] } },
            { method: 'DELETE', path: '/feeds/custom/a%2Fb', body: undefined },
        ])
    })
})

describe('templates', () => {
    test('helpers and partials match the server allowlist', () => {
        expect([...TEMPLATE_HELPERS]).toEqual([
            'if', 'unless', 'each', 'with', 'lookup', 'log',
            'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'and', 'or', 'not',
            'length', 'json', 'date', 'relativeTime', 'number', 'truncate',
            'lower', 'upper', 'plural', 'url', 'asset', 'howlUrl', 'profileUrl',
            'packUrl', 'mediaUrl',
        ])
        expect([...BUILTIN_PARTIALS]).toEqual(['howl', 'like', 'replyButton', 'menu', 'share', 'media', 'author'])
    })
})
