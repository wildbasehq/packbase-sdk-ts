import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK} from '../src'
const originalFetch = globalThis.fetch
afterEach(() => {globalThis.fetch = originalFetch})
for (const copyright of ['© 2024 An artist', null, '']) {
    test(`copyright update preserves ${JSON.stringify(copyright)} and request options`, async () => {
        let request: RequestInit | undefined
        let url = ''
        globalThis.fetch = (async (input, init) => {
            url = String(input)
            request = init
            return Response.json({copyright: copyright || null})
        }) as typeof fetch
        const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
        const signal = new AbortController().signal
        expect(await sdk.howls('id').setCopyright(copyright, {signal})).toEqual({copyright: copyright || null})
        expect(url).toBe('https://api.example.test/howl/id/copyright')
        expect(request?.method).toBe('PUT')
        expect(JSON.parse(String(request?.body))).toEqual({copyright})
        expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer token')
        expect(request?.signal).toBe(signal)
    })
}
