import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type Howl, type HowlCommentResult } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('likes use bodyless idempotent routes without fetching the howl', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
        calls.push({ url: String(input), init })
        return new Response(null, { status: 204 })
    }) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', apiKey: 'member-token', autoLogin: false })
    const handle = sdk.howls('howl-id')
    const signal = new AbortController().signal

    await handle.like({ signal })
    await handle.like()
    await handle.unlike({ signal })
    await handle.unlike()

    expect(calls.map(call => [call.url, call.init?.method, call.init?.body])).toEqual([
        ['https://api.example.test/howl/howl-id/like', 'PUT', undefined],
        ['https://api.example.test/howl/howl-id/like', 'PUT', undefined],
        ['https://api.example.test/howl/howl-id/like', 'DELETE', undefined],
        ['https://api.example.test/howl/howl-id/like', 'DELETE', undefined],
    ])
    expect(calls[0]?.init?.signal).toBe(signal)
    expect(calls[2]?.init?.signal).toBe(signal)
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe('Bearer member-token')
    expect('react' in handle).toBe(false)
    expect('unreact' in handle).toBe(false)
})

test('like failures preserve server errors and an aborted unlike sends no request', async () => {
    let calls = 0
    globalThis.fetch = (async (_input, _init) => {
        calls += 1
        return Response.json({ summary: 'Howl is unavailable' }, { status: 404 })
    }) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })

    await expect(sdk.howls('missing').like()).rejects.toMatchObject({ status: 404 })
    const controller = new AbortController()
    controller.abort()
    await expect(sdk.howls('missing').unlike({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toBe(1)
})

test('howl reads preserve snapshot emoji and personalized zero-like state', async () => {
    const howl: Howl = {
        id: 'howl-id', content_type: 'text', created_at: '2026-09-11T00:00:00Z',
        user: { id: 'author', username: 'author', display_name: 'Author' },
        likes: { emoji: '🦊', count: 0, likedByMe: false },
        comments: [{
            id: 'reply-id', body: 'Reply', content_type: 'text', created_at: '2026-09-11T00:00:00Z',
            user: { id: 'member', username: 'member', display_name: 'Member' },
            likes: { emoji: '🔥', count: 1, likedByMe: true },
        }],
    }
    globalThis.fetch = (async (_input, _init) => Response.json(howl)) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    expect(await sdk.howls('howl-id')).toEqual(howl)
})

test('like emoji settings send only the requested preference', async () => {
    let request: { url: string; init?: RequestInit } | undefined
    globalThis.fetch = (async (input, init) => {
        request = { url: String(input), init }
        return Response.json({ success: true })
    }) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    await sdk.me.settings({ howl_like_emoji: '🔥' })
    expect(request?.url).toBe('https://api.example.test/user/me/settings')
    expect(request?.init?.method).toBe('POST')
    expect(JSON.parse(String(request?.init?.body))).toEqual({ howl_like_emoji: '🔥' })
})

test('new replies return the server emoji snapshot without deriving it from settings', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const result: HowlCommentResult = {
        id: 'new-comment-id',
        likes: { emoji: '👩🏽‍💻', count: 0, likedByMe: false },
    }
    globalThis.fetch = (async (input, init) => {
        calls.push({ url: String(input), init })
        return Response.json(result, { status: 201 })
    }) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    const signal = new AbortController().signal

    expect(await sdk.howls('parent-id').comment('Hello', { signal })).toEqual(result)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.example.test/howl/parent-id/comment')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.signal).toBe(signal)
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ body: 'Hello' })
})
