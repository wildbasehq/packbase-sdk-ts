import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type PackFeedType } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('media filtering has separate request/cache identity and preserves pagination and pins', async () => {
    const urls: string[] = []
    globalThis.fetch = (async (input) => {
        urls.push(String(input))
        return Response.json({ data: [], pins: [], has_more: false })
    }) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    await sdk.feeds('pack-id').fetch({ page: 2, includePinsFrom: 'pack-id', mediaOnly: true })
    await sdk.feeds('pack-id').fetch({ page: 2, includePinsFrom: 'pack-id' })
    await sdk.feeds('pack-id').fetch({ mediaOnly: false })
    expect(urls).toHaveLength(3)
    const gallery = new URL(urls[0]!)
    expect(gallery.searchParams.get('media_only')).toBe('true')
    expect(gallery.searchParams.get('page')).toBe('2')
    expect(gallery.searchParams.get('include_pins_from')).toBe('pack-id')
    expect(new URL(urls[1]!).searchParams.has('media_only')).toBe(false)
    expect(new URL(urls[2]!).searchParams.get('media_only')).toBe('false')
})

test('pack update sends feed type and preserves omitted preference', async () => {
    const bodies: unknown[] = []
    const feedType: PackFeedType = 'gallery'
    globalThis.fetch = (async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)))
        return Response.json({ id: 'pack-id', display_name: 'Art', feed_type: feedType, created_at: '2026-09-09T00:00:00Z' })
    }) as typeof fetch
    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
    const updated = await sdk.packs('pack-id').update({ feed_type: feedType })
    expect(updated.feed_type).toBe(feedType)
    await sdk.packs('pack-id').update({ display_name: 'Art' })
    expect(bodies).toEqual([{ feed_type: 'gallery' }, { display_name: 'Art' }])
})
