import { afterEach, describe, expect, test } from 'bun:test'
import { from, PackbaseSDK, runFeed, viewer, VIEWER_KEYS } from '../src'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('viewer placeholders', () => {
    test('serializes a list placeholder inside an operator', () => {
        expect(from('posts').where({ user_id: { in: viewer('following') } }).build()).toEqual({
            from: 'posts',
            where: { user_id: { in: { $viewer: 'following' } } },
        })
    })

    test('serializes a scalar placeholder as the filter value', () => {
        expect(from('feeds').where({ owner_id: viewer('id') }).build()).toEqual({
            from: 'feeds',
            where: { owner_id: { $viewer: 'id' } },
        })
    })

    test('lists the keys the server resolves', () => {
        expect([...VIEWER_KEYS]).toEqual(['id', 'following', 'followers', 'packs', 'followed_tags'])
    })
})

describe('feeds model', () => {
    test('builds the pinned feeds query ordered by pin position', () => {
        expect(from('feeds').where({ pinned: true }).orderBy('pin_position', 'asc').build()).toEqual({
            from: 'feeds',
            where: { pinned: true },
            orderBy: { pin_position: 'asc' },
        })
    })
})

describe('runFeed', () => {
    test('serializes only the given options', () => {
        expect(runFeed('x', { page: 2 })).toEqual({ run: 'x', page: 2 })
        expect(runFeed('x')).toEqual({ run: 'x' })
        expect(runFeed('x', { presentation: true, revision: 'abc1234' })).toEqual({
            run: 'x',
            presentation: true,
            revision: 'abc1234',
        })
    })

    test('batches a run with a feeds search in one POST /search', async () => {
        const bodies: unknown[] = []
        globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
            bodies.push(JSON.parse(String(init?.body)))
            return Response.json({ feed: { __error: 'not_found' }, pins: [] })
        }) as typeof fetch

        const pb = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
        const result = await pb.search({
            feed: runFeed('x', { page: 2 }),
            pins: from('feeds').where({ pinned: true }).build(),
        })

        expect(bodies).toEqual([{ feed: { run: 'x', page: 2 }, pins: { from: 'feeds', where: { pinned: true } } }])
        expect(result.feed).toEqual({ __error: 'not_found' })
    })
})
