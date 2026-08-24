import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK } from '../src'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('feedback submits the documented request body', async () => {
    let request: { url: string; init?: RequestInit } | undefined
    globalThis.fetch = (async (input, init) => {
        request = { url: String(input), init }
        return Response.json({ sent: true })
    }) as typeof fetch

    const sdk = new PackbaseSDK({
        baseUrl: 'https://api.example.test',
        autoLogin: false,
    })
    const input = {
        canContact: true,
        canSendLogs: false,
        kind: 'idea' as const,
        message: 'Please add this.',
    }

    await expect(sdk.feedback.submit(input)).resolves.toEqual({ sent: true })
    expect(request?.url).toBe('https://api.example.test/feedback')
    expect(request?.init?.method).toBe('POST')
    expect(JSON.parse(String(request?.init?.body))).toEqual(input)
})
