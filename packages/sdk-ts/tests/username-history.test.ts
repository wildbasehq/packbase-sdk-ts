import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK} from '../src'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('username history carries cursor and cancellation, and reads fresh each time', async () => {
    const requests: Array<{url: string; options?: RequestInit}> = []
    const page = {data: [{id: '9007199254740993', username: 'before', changed_at: '2026-10-28T00:00:00.000Z'}], has_more: false}
    globalThis.fetch = (async (input, options) => {
        requests.push({url: String(input), options})
        return Response.json(page)
    }) as typeof fetch
    const client = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
    const signal = new AbortController().signal
    const profile = client.profiles('member/name', {signal})
    expect(await profile.usernameHistory({cursor: '9007199254740994'})).toEqual(page)
    expect(await profile.usernameHistory({cursor: '9007199254740994'})).toEqual(page)
    expect(requests).toHaveLength(2)
    expect(requests[0]?.url).toBe('https://api.example.test/user/member%2Fname/username-history?cursor=9007199254740994')
    expect(requests[0]?.options?.signal).toBe(signal)
})
