import { afterEach, describe, expect, test } from 'bun:test'
import { HttpClient } from '../src/http'

const originalFetch = globalThis.fetch

interface Deferred<T> {
    promise: Promise<T>
    resolve(value: T): void
    reject(reason?: unknown): void
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return {promise, resolve, reject}
}

function jsonResponse(value: unknown): Response {
    return new Response(JSON.stringify(value), {
        headers: {'Content-Type': 'application/json'},
    })
}

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('HttpClient GET request coalescing', () => {
    test('coalesces identical concurrent requests without storing the response', async () => {
        const firstResponse = deferred<Response>()
        let calls = 0
        globalThis.fetch = (() => {
            calls += 1
            if (calls === 1) return firstResponse.promise
            return Promise.resolve(jsonResponse({version: calls}))
        }) as unknown as typeof fetch

        const client = new HttpClient({baseUrl: 'https://api.example'})
        const first = client.get<{version: number}>('/resource')
        const concurrent = client.get<{version: number}>('/resource')

        expect(calls).toBe(1)
        firstResponse.resolve(jsonResponse({version: 1}))
        expect(await Promise.all([first, concurrent])).toEqual([
            {version: 1},
            {version: 1},
        ])

        expect(await client.get<{version: number}>('/resource')).toEqual({version: 2})
        expect(calls).toBe(2)
    })

    test('does not coalesce requests that have independent abort signals', async () => {
        const responses: Deferred<Response>[] = []
        globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
            const response = deferred<Response>()
            responses.push(response)
            init?.signal?.addEventListener('abort', () => {
                response.reject(init.signal?.reason)
            }, {once: true})
            return response.promise
        }) as unknown as typeof fetch

        const client = new HttpClient({baseUrl: 'https://api.example'})
        const firstController = new AbortController()
        const secondController = new AbortController()
        const first = client.get('/resource', undefined, {signal: firstController.signal})
        const second = client.get<{ok: boolean}>('/resource', undefined, {
            signal: secondController.signal,
        })

        expect(responses).toHaveLength(2)
        firstController.abort(new DOMException('Cancelled', 'AbortError'))
        await expect(first).rejects.toThrow('Cancelled')

        responses[1]!.resolve(jsonResponse({ok: true}))
        await expect(second).resolves.toEqual({ok: true})
    })

    test('does not join a read that began before a successful mutation', async () => {
        const reads = [deferred<Response>(), deferred<Response>()]
        let readCount = 0
        globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
            if (init?.method === 'POST') return Promise.resolve(jsonResponse({ok: true}))
            const response = reads[readCount]
            readCount += 1
            return response!.promise
        }) as unknown as typeof fetch

        const client = new HttpClient({baseUrl: 'https://api.example'})
        const staleRead = client.get<{version: number}>('/resource')

        await client.post('/resource', {name: 'updated'})
        const freshRead = client.get<{version: number}>('/resource')

        expect(readCount).toBe(2)
        reads[1]!.resolve(jsonResponse({version: 2}))
        await expect(freshRead).resolves.toEqual({version: 2})

        reads[0]!.resolve(jsonResponse({version: 1}))
        await expect(staleRead).resolves.toEqual({version: 1})
    })
})
