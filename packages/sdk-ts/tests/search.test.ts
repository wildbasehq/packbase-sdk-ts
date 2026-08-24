import { afterEach, describe, expect, test } from 'bun:test'
import { from, PackbaseSDK } from '../src'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('search', () => {
    test('builds a posts query filtered by indexed asset type', () => {
        expect(
            from('posts')
                .where({ asset_types: { has: 'video' } })
                .orderBy('created_at', 'desc')
                .build(),
        ).toEqual({
            from: 'posts',
            where: { asset_types: { has: 'video' } },
            orderBy: { created_at: 'desc' },
        })
    })

    test('sends the asset type filter unchanged to POST /search', async () => {
        const requests: Array<{ url: string; init?: RequestInit }> = []
        globalThis.fetch = (async (input, init) => {
            requests.push({ url: String(input), init })
            return Response.json({ videos: [] })
        }) as typeof fetch

        const pb = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
        await pb.search({
            videos: from('posts').where({ asset_types: { has: 'video' } }).build(),
        })

        expect(requests).toHaveLength(1)
        expect(requests[0]?.url).toBe('https://api.example.test/search')
        expect(requests[0]?.init?.method).toBe('POST')
        expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
            videos: {
                from: 'posts',
                where: { asset_types: { has: 'video' } },
            },
        })
    })
})
