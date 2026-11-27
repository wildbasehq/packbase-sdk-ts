import { expect, test } from 'bun:test'
import { clampTake, queryHost, type QueryExecuteOptions } from '../src/scripts'

const at = { script: 'boot', node: 'run' }
const list = (count: number) => Array.from({ length: count }, (_, index) => ({ id: String(index) }))

function fixture(answer: unknown) {
    const calls: { query: Record<string, unknown>; options: QueryExecuteOptions }[] = []
    const host = queryHost({
        execute: async (query, options) => {
            calls.push({ query, options })
            return answer
        },
    })
    return { calls, host }
}

test('clampTake keeps a take within what a search returns', () => {
    expect(clampTake(undefined)).toBe(50)
    expect(clampTake(0)).toBe(50)
    expect(clampTake('12')).toBe(50)
    expect(clampTake(12.7)).toBe(12)
    expect(clampTake(500)).toBe(200)
})

test('a query given a page gets that page’s window and one extra row', async () => {
    const { calls, host } = fixture(list(11))
    const rows = await host.tool({ query: { from: 'posts', take: 10, page: 3 } }, {}, at)
    expect(calls).toEqual([{ query: { from: 'posts', feed: true, take: 10, skip: 20 }, options: { extraRow: true } }])
    expect(rows).toHaveLength(10)
    expect(host.hasMore()).toBe(true)
})

test('a page with no row past it has no more', async () => {
    const { host } = fixture(list(10))
    expect(await host.tool({ query: { from: 'posts', take: 10, page: 1 } }, {}, at)).toHaveLength(10)
    expect(host.hasMore()).toBe(false)
})

test('a page below 1, or not a whole number, is the first page', async () => {
    const { calls, host } = fixture(list(1))
    await host.tool({ query: { from: 'posts', take: 10, page: 0 } }, {}, at)
    await host.tool({ query: { from: 'posts', take: 10, page: 2.9 } }, {}, at)
    expect(calls.map((call) => call.query.skip)).toEqual([0, 10])
})

test('a query with no page runs unchanged under the reader’s ratings', async () => {
    const { calls, host } = fixture(list(3))
    await host.tool({ query: { from: 'posts', take: 3 } }, {}, at)
    expect(calls).toEqual([{ query: { from: 'posts', take: 3 }, options: { readerRatings: true } }])
    expect(host.hasMore()).toBe(false)
})

test('any paged query with more rows means there is more', async () => {
    const calls: number[] = []
    const host = queryHost({
        execute: async (query) => {
            calls.push(1)
            return query.from === 'posts' ? list(3) : list(11)
        },
    })
    await host.tool({ query: { from: 'posts', take: 10, page: 1 } }, {}, at)
    expect(host.hasMore()).toBe(false)
    await host.tool({ query: { from: 'packs', take: 10, page: 1 } }, {}, at)
    await host.tool({ query: { from: 'posts', take: 10, page: 1 } }, {}, at)
    expect(host.hasMore()).toBe(true)
})

test('a result that is not a list passes through', async () => {
    const { host } = fixture({ __error: 'Query failed' })
    expect(await host.tool({ query: { from: 'posts', page: 1 } }, {}, at)).toEqual({ __error: 'Query failed' })
    expect(host.hasMore()).toBe(false)
})
