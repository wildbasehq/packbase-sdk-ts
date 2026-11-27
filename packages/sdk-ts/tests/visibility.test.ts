import { afterEach, expect, test } from 'bun:test'
import { from, PackbaseError, PackbaseSDK } from '../src'
import { HttpClient } from '../src/http'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const client = (apiKey?: string) => new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false, apiKey})
const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => { resolve = done })
    return {promise, resolve}
}
const record = {
    profile_id: 'profile-id', created_at: '2026-09-11T00:00:00.000Z',
    identity: {username: 'member', display_name: null},
}

test('private relationship APIs preserve snapshots, pagination and auth without exposing extra profile fields', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({url: String(input), init})
        return Response.json({data: [{...record, blocked_by_me: true, identity: {...record.identity, online: true}}], has_more: true, cursor: 'next'})
    }) as typeof fetch
    const pb = client('token')
    for (const resource of [pb.me.mutes, pb.me.blocks]) {
        expect(await resource.list({cursor: 'previous', limit: 25})).toEqual({data: [record], has_more: true, cursor: 'next'})
    }
    expect(requests.map(r => r.url)).toEqual([
        'https://api.example.test/user/me/mutes?cursor=previous&limit=25',
        'https://api.example.test/user/me/blocks?cursor=previous&limit=25',
    ])
    for (const request of requests) {
        expect(request.init?.cache).toBe('no-store')
        expect(request.init?.credentials).toBe('omit')
        expect(new Headers(request.init?.headers).get('Authorization')).toBe('Bearer token')
    }
})

test('add/remove use immutable encoded IDs and invalidate once per successful change', async () => {
    const requests: Array<[string, string | undefined, BodyInit | null | undefined]> = []
    globalThis.fetch = (async (input, init) => {
        requests.push([String(input), init?.method, init?.body])
        return new Response(null, {status: 204})
    }) as typeof fetch
    const pb = client()
    const generations: number[] = []
    pb.on('visibilityChanged', value => generations.push(value))
    for (const resource of [pb.me.mutes, pb.me.blocks]) {
        await resource.add('member/id')
        await resource.remove('member/id')
    }
    expect(requests).toEqual([
        ['https://api.example.test/user/me/mutes/member%2Fid', 'PUT', undefined],
        ['https://api.example.test/user/me/mutes/member%2Fid', 'DELETE', undefined],
        ['https://api.example.test/user/me/blocks/member%2Fid', 'PUT', undefined],
        ['https://api.example.test/user/me/blocks/member%2Fid', 'DELETE', undefined],
    ])
    expect(generations).toEqual([1, 2, 3, 4])
    expect(pb.getVisibilityGeneration()).toBe(4)
})

test('failed relationships retain ordinary 404 errors and do not invalidate', async () => {
    let requests = 0
    globalThis.fetch = (async (_input, _init) => { requests++; return Response.json({summary: 'Not Found'}, {status: 404}) }) as typeof fetch
    const pb = client()
    try {
        await pb.me.blocks.add('missing')
        throw new Error('Expected failure')
    } catch (error) {
        expect(error).toBeInstanceOf(PackbaseError)
        expect((error as PackbaseError).isNotFound).toBe(true)
        expect((error as PackbaseError).code).toBeUndefined()
    }
    expect(requests).toBe(1)
    expect(pb.getVisibilityGeneration()).toBe(0)
})

test('aborted relationships and watch issue no request; active signals are forwarded', async () => {
    const signals: Array<AbortSignal | null | undefined> = []
    globalThis.fetch = (async (_input, init) => {
        signals.push(init?.signal)
        return new Response(null, {status: 204})
    }) as typeof fetch
    const pb = client()
    const aborted = AbortSignal.abort()
    await expect(pb.me.mutes.list({signal: aborted})).rejects.toMatchObject({name: 'AbortError'})
    await expect(pb.me.blocks.add('id', {signal: aborted})).rejects.toMatchObject({name: 'AbortError'})
    await expect(pb.me.blocks.remove('id', {signal: aborted})).rejects.toMatchObject({name: 'AbortError'})
    await expect(pb.visibility.watch({signal: aborted})).rejects.toMatchObject({name: 'AbortError'})
    expect(signals).toHaveLength(0)
    const controller = new AbortController()
    await pb.me.mutes.add('id', {signal: controller.signal})
    expect(signals).toEqual([controller.signal])
})

test('relationship decoding rejects malformed snapshots and pagination', async () => {
    const pb = client()
    for (const body of [null, {data: [], has_more: 'true'}, {data: [record], has_more: false, cursor: null},
        {data: [{...record, identity: {username: 'name', display_name: 2}}], has_more: false}]) {
        globalThis.fetch = (async (_input, _init) => Response.json(body)) as typeof fetch
        await expect(pb.me.blocks.list()).rejects.toBeInstanceOf(TypeError)
    }
})

test('watch long polls without sharing or cache and returns only opaque cursor and changed', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({url: String(input), init})
        return Response.json({cursor: 'opaque', changed: true, actor_id: 'never-expose'})
    }) as typeof fetch
    const pb = client()
    const result = await Promise.all([pb.visibility.watch({cursor: 'old cursor', waitMs: 25000}), pb.visibility.watch()])
    expect(result).toEqual([{cursor: 'opaque', changed: true}, {cursor: 'opaque', changed: true}])
    expect(requests[0]?.url).toBe('https://api.example.test/visibility/watch?cursor=old+cursor&wait_ms=25000')
    expect(requests[1]?.url).toBe('https://api.example.test/visibility/watch')
    expect(requests.every(r => r.init?.cache === 'no-store' && r.init?.credentials === 'include')).toBe(true)
    expect(pb.getVisibilityGeneration()).toBe(0)
    globalThis.fetch = (async (_input, _init) => Response.json({cursor: 1, changed: true})) as typeof fetch
    await expect(pb.visibility.watch()).rejects.toBeInstanceOf(TypeError)
})

test('feed/direct context survives search serialization and separate detail hydration', async () => {
    const requests: Array<{url: string; body?: unknown}> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined})
        return Response.json({})
    }) as typeof fetch
    const pb = client()
    await pb.search({feed: from('posts').context('feed').build(), profile: from('posts').context('direct').build()})
    await pb.howls('howl', {context: 'feed'})
    await pb.howls('howl', {context: 'direct'})
    expect(requests).toEqual([
        {url: 'https://api.example.test/search', body: {feed: {from: 'posts', context: 'feed'}, profile: {from: 'posts', context: 'direct'}}},
        {url: 'https://api.example.test/howl/howl?context=feed', body: undefined},
        {url: 'https://api.example.test/howl/howl?context=direct', body: undefined},
    ])
})

test('existing profile, pack and howl handles refetch after visibility invalidation', async () => {
    const pb = client()
    let reads = 0
    globalThis.fetch = (async (_input, _init) => {
        reads++
        return pb.getVisibilityGeneration() === 0 ? Response.json({id: 'visible'}) : Response.json({summary: 'Not Found'}, {status: 404})
    }) as typeof fetch
    const handles = [pb.profiles('member'), pb.packs('pack'), pb.howls('howl')]
    for (const handle of handles) { await handle; await handle }
    expect(reads).toBe(3)
    pb.invalidateVisibility()
    for (const handle of handles) await expect(Promise.resolve(handle)).rejects.toMatchObject({status: 404})
    expect(reads).toBe(6)
})

test('old in-flight reads cannot publish stale content and fresh reads do not share them', async () => {
    const first = deferred<Response>()
    const pb = client()
    let reads = 0
    globalThis.fetch = (async (_input, _init) => ++reads === 1 ? first.promise : Response.json({id: 'current'})) as typeof fetch
    const pending = Promise.resolve(pb.profiles('member'))
    await Promise.resolve()
    pb.invalidateVisibility()
    expect((await pb.profiles('member')).id).toBe('current')
    first.resolve(Response.json({id: 'stale'}))
    expect((await pending).id).toBe('current')
    expect(reads).toBe(3)
})

test('read-only search is repeated after visibility changes, but writes and legacy mutation GETs never are', async () => {
    const first = deferred<Response>()
    const pb = client()
    let reads = 0
    globalThis.fetch = (async (_input, _init) => ++reads === 1 ? first.promise : Response.json({posts: []})) as typeof fetch
    const search = pb.search({posts: from('posts').build()})
    pb.invalidateVisibility()
    first.resolve(Response.json({posts: [{id: 'stale'}]}))
    expect(await search).toEqual({posts: []})
    expect(reads).toBe(2)

    for (const method of ['post', 'getMutation'] as const) {
        const response = deferred<Response>()
        let writes = 0
        globalThis.fetch = (async (_input, _init) => {writes++; return response.promise}) as typeof fetch
        const http = new HttpClient({baseUrl: 'https://api.example.test'})
        const mutation = http[method]('/mutation')
        http.invalidateVisibility()
        response.resolve(Response.json({success: true}))
        expect(await mutation).toEqual({success: true})
        expect(writes).toBe(1)
    }
})

test('cancelled stale reads do not refetch after their late response arrives', async () => {
    const response = deferred<Response>()
    const controller = new AbortController()
    const pb = client()
    let reads = 0
    globalThis.fetch = (async (_input, _init) => { reads++; return response.promise }) as typeof fetch
    const pending = pb.search({posts: from('posts').build()}, {signal: controller.signal})
    controller.abort()
    pb.invalidateVisibility()
    response.resolve(Response.json({posts: [{id: 'stale'}]}))
    await expect(pending).rejects.toMatchObject({name: 'AbortError'})
    expect(reads).toBe(1)
})


test('server visibility conflicts invalidate and retry reads but never repeat mutations', async () => {
    const pb = client()
    let requests = 0
    globalThis.fetch = (async (_input, _init) => {
        requests++
        return requests === 1
            ? Response.json({summary: 'Visibility changed', code: 'visibility_changed'}, {status: 409})
            : Response.json({posts: []})
    }) as typeof fetch
    expect(await pb.search({posts: from('posts').build()})).toEqual({posts: []})
    expect(requests).toBe(2)
    expect(pb.getVisibilityGeneration()).toBe(1)

    requests = 0
    globalThis.fetch = (async (_input, _init) => {
        requests++
        return Response.json({summary: 'Visibility changed', code: 'visibility_changed'}, {status: 409})
    }) as typeof fetch
    await expect(pb.me.blocks.add('profile')).rejects.toMatchObject({status: 409, code: 'visibility_changed'})
    expect(requests).toBe(1)
    expect(pb.getVisibilityGeneration()).toBe(2)
})
