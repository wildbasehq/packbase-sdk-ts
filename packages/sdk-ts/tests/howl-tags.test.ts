import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK, type Howl, type HowlTagEditResult} from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const result: HowlTagEditResult = {
    tags: ['rating_safe', 'art'],
    moderator_tags: ['rating_safe'],
    tag_revision: 2,
    edit: {
        id: '9007199254740993',
        revision: 2,
        created_at: '2026-11-02T00:00:00.000Z',
        editor: {id: 'member-id', username: 'member', display_name: 'Member'},
        explanation: 'Added the medium used.',
        added_tags: ['art'],
        removed_tags: [],
        locked_tags: [],
        unlocked_tags: [],
    },
}

test('tag edits preserve explanation, revision, optional locks, and request options', async () => {
    let url = ''
    let request: RequestInit | undefined
    globalThis.fetch = (async (input, init) => {
        url = String(input)
        request = init
        return Response.json(result)
    }) as typeof fetch
    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
    const signal = new AbortController().signal
    const input = {
        tags: ['rating_safe', 'art'],
        explanation: 'Added the medium used.',
        expected_revision: 1,
        moderator_tags: ['rating_safe'],
    }

    expect(await sdk.howls('howl/id', {signal}).setTags(input)).toEqual(result)
    expect(url).toBe('https://api.example.test/howl/howl%2Fid/tags')
    expect(request?.method).toBe('PUT')
    expect(JSON.parse(String(request?.body))).toEqual(input)
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer token')
    expect(request?.signal).toBe(signal)
})

test('tag history carries pagination and cancellation and reads fresh each time', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    const page = {data: [result.edit], has_more: true, cursor: result.edit.id}
    globalThis.fetch = (async (input, init) => {
        requests.push({url: String(input), init})
        return Response.json(page)
    }) as typeof fetch
    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
    const signal = new AbortController().signal
    const howl = sdk.howls('howl/id', {signal, context: 'feed'})

    expect(await howl.tagHistory({cursor: '9007199254740994'})).toEqual(page)
    expect(await howl.tagHistory({cursor: '9007199254740994'})).toEqual(page)
    expect(requests).toHaveLength(2)
    expect(requests[0]?.url).toBe('https://api.example.test/howl/howl%2Fid/tag-history?cursor=9007199254740994&context=feed')
    expect(requests[0]?.init?.signal).toBe(signal)
    expect(requests[0]?.init?.cache).toBe('no-store')
    expect(new Headers(requests[0]?.init?.headers).get('Authorization')).toBe('Bearer token')
})

test('tag edits surface stale revision failures without retrying the write', async () => {
    let requests = 0
    globalThis.fetch = (async (_input, _init) => {
        requests += 1
        return Response.json({error: 'Tags changed. Reload before saving.', code: 'tag_revision_conflict'}, {status: 409})
    }) as typeof fetch
    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})

    await expect(sdk.howls('id').setTags({tags: ['rating_safe'], explanation: 'Corrected the rating.', expected_revision: 0})).rejects.toMatchObject({status: 409})
    expect(requests).toBe(1)
})

test('fresh howl reads bypass cached state for the tag editor and retain read context', async () => {
    let request: RequestInit | undefined
    let url = ''
    globalThis.fetch = (async (input, init) => {
        url = String(input)
        request = init
        return Response.json({id: 'howl/id', tag_revision: 7, can_edit_tags: true})
    }) as typeof fetch
    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    const signal = new AbortController().signal

    const howl = await sdk.howls('howl/id', {fresh: true, context: 'direct', signal})
    expect(howl.tag_revision).toBe(7)
    expect(url).toBe('https://api.example.test/howl/howl%2Fid?context=direct')
    expect(request?.cache).toBe('no-store')
    expect(request?.signal).toBe(signal)
})

test('reply pagination preserves offsets, visibility context and nested counts', async () => {
    const urls: string[] = []
    const reply = {id: 'reply', body: 'Nested reply', content_type: 'text', created_at: '2026-11-10T00:00:00Z', user: {id: 'author', username: 'author', display_name: 'Author'}, likes: {emoji: '🔥', count: 0, likedByMe: false}, comments_count: 2, comments: []}
    const page: Howl = {...reply, content_type: 'text', id: 'root', comments_count: 6, comments: [reply]}
    globalThis.fetch = (async (input) => {
        urls.push(String(input))
        return Response.json(page)
    }) as typeof fetch
    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    expect(await sdk.howls('root', {context: 'feed', replyOffset: 5})).toEqual(page)
    expect(await sdk.howls('root', {context: 'direct', replyOffset: 0, fresh: true})).toEqual(page)
    expect(urls).toEqual([
        'https://api.example.test/howl/root?context=feed&reply_offset=5',
        'https://api.example.test/howl/root?context=direct&reply_offset=0',
    ])
})
