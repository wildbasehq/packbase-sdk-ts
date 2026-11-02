import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type FeedExplanation } from '../src'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('feed and search preserve per-request provenance through SDK transport', async () => {
    const explanation: FeedExplanation = { version: 1, source: 'search', order: 'newest_first', signals: [], filters: [], query: { where: { parent: null, tags: { has: 'art' } }, order_by: [{ field: 'created_at', direction: 'desc' }, { field: 'id', direction: 'desc' }], context: 'feed' } }
    globalThis.fetch = (async (input) => Response.json(String(input).endsWith('/search')
        ? { posts: [{ id: 'echo', feed_explanation: explanation }] }
        : { data: [{ id: 'echo', canonical_id: 'original' }], pins: [], has_more: false, explanations: { echo: explanation } })) as typeof fetch
    const client = new PackbaseSDK({ baseUrl: 'https://example.test', autoLogin: false })
    const page = await client.feeds('universe:home').fetch()
    expect(page.explanations?.echo).toEqual(explanation)
    expect(page.explanations?.original).toBeUndefined()
    const result = await client.search({ posts: { from: 'posts', feed: true } })
    if (!Array.isArray(result.posts)) throw Error('Unexpected search error')
    expect(result.posts[0]?.feed_explanation).toEqual(explanation)
})
