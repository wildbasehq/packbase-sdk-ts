import { afterEach, describe, expect, test } from 'bun:test'
import { PackbaseError } from '../src/errors'
import { HttpClient } from '../src/http'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('HttpClient', () => {
    test('coalesces concurrent reads and removes trailing base URL slashes', async () => {
        let requestCount = 0
        globalThis.fetch = (async input => {
            requestCount++
            return Response.json({ url: String(input) })
        }) as typeof fetch

        const http = new HttpClient({ baseUrl: 'https://api.example.test///' })
        const [first, second] = await Promise.all([
            http.get<{ url: string }>('/health'),
            http.get<{ url: string }>('/health'),
        ])

        expect(requestCount).toBe(1)
        expect(first).toEqual(second)
        expect(first.url).toBe('https://api.example.test/health')
    })

    test('normalizes non-object and invalid error responses', async () => {
        const responses = [
            Response.json(['not', 'an', 'error'], { status: 400 }),
            new Response('not json', { status: 502 }),
        ]
        globalThis.fetch = (async (_input, _init) => responses.shift()!) as typeof fetch

        const http = new HttpClient({ baseUrl: 'https://api.example.test' })

        for (const expectedStatus of [400, 502]) {
            try {
                await http.get('/failure')
                throw new Error('Expected the request to fail')
            } catch (error) {
                expect(error).toBeInstanceOf(PackbaseError)
                expect((error as PackbaseError).status).toBe(expectedStatus)
                expect((error as PackbaseError).summary).toBe('Unknown error')
            }
        }
    })

    test('ignores non-string machine-readable error codes', async () => {
        globalThis.fetch = (async (_input, _init) =>
            Response.json({ summary: 'Nope', code: 123 }, { status: 409 })) as typeof fetch

        const http = new HttpClient({ baseUrl: 'https://api.example.test' })

        try {
            await http.post('/failure')
            throw new Error('Expected the request to fail')
        } catch (error) {
            expect(error).toBeInstanceOf(PackbaseError)
            expect((error as PackbaseError).code).toBeUndefined()
        }
    })
})
