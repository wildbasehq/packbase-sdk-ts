import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, PackPermissionBits, formatEmoteToken, type PackEmote, type Profile, type Howl } from '../src'
import { makeMe } from '../src/resources/me'
import { HttpClient } from '../src/http'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const emote: PackEmote = {
    id: '12345678-1234-4234-8234-123456789abc', pack_id: 'pack-id',
    pack_name: 'Artists', shortcode: 'wave', label: 'Wave',
    src: 'https://cdn.example.test/emotes/wave.webp',
    still_src: 'https://cdn.example.test/emotes/wave.png', animated: true, nsfw: true,
}

test('emote methods send typed inputs directly, without fetching the Pack', async () => {
    const calls: Array<{url: string; init?: RequestInit}> = []
    globalThis.fetch = (async (input, init) => {
        calls.push({url: String(input), init})
        if (init?.method === 'DELETE') return new Response(null, {status: 204})
        return Response.json(init?.method === 'GET' ? [emote] : emote)
    }) as typeof fetch
    const pb = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
    const signal = new AbortController().signal
    const handle = pb.packs('pack/id').emotes
    expect(await handle.list({signal})).toEqual([emote])
    expect(await handle.upload({shortcode: 'wave', image: 'data:image/png;base64,AA==', nsfw: true})).toEqual(emote)
    expect(await handle.update('emote/id', {label: 'Hello', nsfw: false})).toEqual(emote)
    await handle.remove('emote/id', {signal})
    expect(await pb.me.emotes({signal})).toEqual([emote])
    expect(calls.map(call => [call.url, call.init?.method])).toEqual([
        ['https://api.example.test/pack/pack%2Fid/emotes', 'GET'],
        ['https://api.example.test/pack/pack%2Fid/emotes', 'POST'],
        ['https://api.example.test/pack/pack%2Fid/emotes/emote%2Fid', 'PUT'],
        ['https://api.example.test/pack/pack%2Fid/emotes/emote%2Fid', 'DELETE'],
        ['https://api.example.test/user/me/emotes', 'GET'],
    ])
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({shortcode: 'wave', image: 'data:image/png;base64,AA==', nsfw: true})
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({label: 'Hello', nsfw: false})
    expect(calls[3]?.init?.body).toBeUndefined()
    expect(calls[0]?.init?.signal).toBe(signal)
    expect(calls[4]?.init?.signal).toBe(signal)
    expect(new Headers(calls[1]?.init?.headers).get('Authorization')).toBe('Bearer token')
    expect(PackPermissionBits.ManageEmotes).toBe(16384)
})

test('formatting preserves stable IDs and refuses malformed references', () => {
    expect(formatEmoteToken(emote)).toBe(`:wave(${emote.id}):`)
    expect(formatEmoteToken({...emote, shortcode: 'hello'})).toBe(`:hello(${emote.id}):`)
    expect(() => formatEmoteToken({...emote, shortcode: 'bad):<img>'})).toThrow(TypeError)
    expect(() => formatEmoteToken({...emote, id: 'not-a-uuid'})).toThrow(TypeError)
})

test('emote authorization errors remain server-owned and aborted requests send nothing', async () => {
    let calls = 0
    globalThis.fetch = (async (_input, _init) => {
        calls++
        return Response.json({summary: 'Manage Emotes is required'}, {status: 403})
    }) as typeof fetch
    const pb = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    await expect(pb.packs('pack').emotes.upload({shortcode: 'wave', image: 'data:image/png;base64,AA==', nsfw: true}))
        .rejects.toMatchObject({status: 403})
    const controller = new AbortController(); controller.abort()
    await expect(pb.me.emotes({signal: controller.signal})).rejects.toMatchObject({name: 'AbortError'})
    expect(calls).toBe(1)
})

test('content reads retain custom metadata without reading membership catalogues', async () => {
    const profile: Profile = {id: 'author', username: 'artist', display_name: formatEmoteToken(emote), emotes: [emote]}
    const howl: Howl = {id: 'howl', content_type: 'text', created_at: '2026-11-07T00:00:00Z',
        user: profile, emotes: [emote], likes: {emoji: formatEmoteToken(emote), emote, count: 0, likedByMe: false}}
    const calls: string[] = []
    globalThis.fetch = (async input => {calls.push(String(input)); return Response.json(howl)}) as typeof fetch
    const pb = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    expect(await pb.howls('howl')).toEqual(howl)
    expect(calls).toEqual(['https://api.example.test/howl/howl'])
})

test('hydrating profile metadata cannot replace the current-member catalogue method', () => {
    const http = {} as HttpClient
    const me = makeMe(http)
    const catalogueMethod = me.emotes
    me.hydrate({id: 'member', username: 'member', display_name: 'Member', emotes: [emote]})
    expect(me.emotes).toBe(catalogueMethod)
    expect(me.username).toBe('member')
})
