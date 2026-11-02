import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK} from '../src'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('profile update sends username and returns the canonical saved name', async () => {
    let request: RequestInit | undefined
    globalThis.fetch = (async (_input, init) => {
        request = init
        return Response.json({id: 'profile', username: 'new-name'})
    }) as typeof fetch
    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
    expect(await sdk.me.update({username: 'new-name'})).toEqual({id: 'profile', username: 'new-name'})
    expect(request?.method).toBe('POST')
    expect(JSON.parse(String(request?.body))).toEqual({username: 'new-name'})
})
