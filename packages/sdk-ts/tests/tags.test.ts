import { afterEach, describe, expect, test } from 'bun:test'
import { PackbaseSDK } from '../src'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('tag follows', () => {
    test('lists the authenticated user\'s followed tags', async () => {
        const requests: Array<{ url: string; init?: RequestInit }> = []
        globalThis.fetch = (async (input, init) => {
            requests.push({ url: String(input), init })
            return new Response(JSON.stringify(['digital_art', 'photography']), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }) as typeof fetch

        const pb = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })

        await expect(pb.tags.following()).resolves.toEqual(['digital_art', 'photography'])
        expect(requests).toHaveLength(1)
        expect(requests[0]?.url).toBe('https://api.example.test/user/me/following/tags')
        expect(requests[0]?.init?.method).toBe('GET')
    })

    test('follows and unfollows an encoded tag', async () => {
        const requests: Array<{ url: string; init?: RequestInit }> = []
        globalThis.fetch = (async (input, init) => {
            requests.push({ url: String(input), init })
            return new Response(null, { status: 204 })
        }) as typeof fetch

        const pb = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })

        await expect(pb.tags.follow('art/cats')).resolves.toBeUndefined()
        await expect(pb.tags.unfollow('art/cats')).resolves.toBeUndefined()

        expect(requests.map(({ url, init }) => [url, init?.method])).toEqual([
            ['https://api.example.test/tags/art%2Fcats/follow', 'POST'],
            ['https://api.example.test/tags/art%2Fcats/follow', 'DELETE'],
        ])
    })
})
