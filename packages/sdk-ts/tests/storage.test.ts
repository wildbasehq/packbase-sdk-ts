import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('storage reads remain fresh, preserve the server allowance, and forward cancellation', async () => {
    const calls: RequestInit[] = []
    const usage = { files: [], totalBytes: 5, allowanceBytes: 15_000_000, remainingBytes: 14_999_995, overLimit: false, fileCount: 1, localBytes: 10, breakdown: { mediaBytes: 5, videoBytes: 0, themeBytes: 0, excludedImageBytes: 0 } }
    globalThis.fetch = (async (url, init) => {
        expect(String(url)).toBe('https://api.example.test/user/me/storage')
        calls.push(init!)
        return Response.json(usage)
    }) as typeof fetch
    const client = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    const signal = new AbortController().signal
    const results = await Promise.all([client.me.storage({ signal }), client.me.storage({ signal })])
    expect(results).toEqual([usage, usage])
    expect(calls).toHaveLength(2)
    expect(calls.every(call => call.cache === 'no-store' && call.signal === signal)).toBe(true)
})
