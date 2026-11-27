import { expect, test } from 'bun:test'
import { clampTake, queryHost, type QueryExecuteOptions } from '../src/scripts'

const at = { script: 'boot', node: 'run' }
const list = (count: number) => Array.from({ length: count }, (_, index) => ({ id: String(index) }))

function fixture(page: number | string, answer: unknown) {
    const calls: { query: Record<string, unknown>; options: QueryExecuteOptions }[] = []
    const host = queryHost({
        page,
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

test('a paged query gets its page window and one extra row', async () => {
    const { calls, host } = fixture(3, list(11))
    const rows = await host.tool({ query: { from: 'posts', take: 10 } }, { paged: true }, at)
    expect(calls).toEqual([{ query: { from: 'posts', feed: true, take: 10, skip: 20 }, options: { extraRow: true } }])
    expect(rows).toHaveLength(10)
    expect(host.hasMore()).toBe(true)
})

test('a paged query with no row past the page has no more', async () => {
    const { host } = fixture(1, list(10))
    expect(await host.tool({ query: { from: 'posts', take: 10 } }, { paged: true }, at)).toHaveLength(10)
    expect(host.hasMore()).toBe(false)
})

test('an unpaged query runs unchanged under the reader’s ratings', async () => {
    const { calls, host } = fixture(2, list(3))
    await host.tool({ query: { from: 'posts', take: 3 } }, {}, at)
    expect(calls).toEqual([{ query: { from: 'posts', take: 3 }, options: { readerRatings: true } }])
    expect(host.hasMore()).toBe(false)
})

test('a page that is a name never pages', async () => {
    const { calls, host } = fixture('about', list(3))
    await host.tool({ query: { from: 'posts' } }, { paged: true }, at)
    expect(calls[0]!.options).toEqual({ readerRatings: true })
})

test('a result that is not a list passes through', async () => {
    const { host } = fixture(1, { __error: 'Query failed' })
    expect(await host.tool({ query: { from: 'posts' } }, { paged: true }, at)).toEqual({ __error: 'Query failed' })
    expect(host.hasMore()).toBe(false)
})
