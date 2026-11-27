import { describe, expect, test } from 'bun:test'
import { feedKind, runProgram, type HostTool, type Program, type ScriptFile, type ScriptNode, type TraceAt, type TraceResult } from '../src/scripts'

const script = (
    nodes: Record<string, ScriptNode>,
    outputs: Record<string, string>,
    inputs?: ScriptFile['inputs'],
): ScriptFile => ({ version: 1, ...(inputs ? { inputs } : {}), nodes, outputs })

const rows = [
    { id: 'a', user_id: 'u1', body: 'Hello World', likes: 3, tags: ['art', 'wip'], parent: null, created_at: '2026-01-03' },
    { id: 'b', user_id: 'u2', body: 'second', likes: 10, tags: [], parent: 'a', created_at: '2026-01-01' },
    { id: 'c', user_id: 'u1', body: 'third thing', likes: 1, tags: ['art'], parent: null, created_at: '2026-01-02' },
    { id: 'd', user_id: 'u3', body: null, likes: 7, tags: ['photo'], parent: null, created_at: '2026-01-04' },
]

/** A host whose query.run answers from fixtures by model and records every call. */
function host(data: Record<string, unknown> = { posts: rows }) {
    const calls: { query: any; params: Record<string, unknown>; at: { script: string; node: string } }[] = []
    const run: HostTool = async (inputs, params, at) => {
        calls.push({ query: inputs.query, params, at })
        return data[(inputs.query as { from: string }).from]
    }
    return { calls, tools: { 'query.run': run } }
}

const source: Record<string, ScriptNode> = {
    q: { tool: 'query.build', params: { from: 'posts' } },
    posts: { tool: 'query.run', in: { query: 'q' } },
}

async function one(node: ScriptNode, extra: Record<string, ScriptNode> = {}, data?: Record<string, unknown>) {
    const result = await runProgram(
        { boot: script({ ...source, ...extra, out: node }, { out: 'out' }) },
        { kind: feedKind, inputs: { page: 1 }, host: host(data).tools },
    )
    if ('problem' in result) throw new Error(result.problem.message)
    return result.outputs.out as any
}
const ids = (list: { id: string }[]) => list.map((row) => row.id).join('')
const filter = (where: unknown) => one({ tool: 'filter', in: { list: 'posts' }, params: { where } }).then(ids)

describe('list tools', () => {
    test('sort', async () => {
        expect(ids(await one({ tool: 'sort', in: { list: 'posts' }, params: { by: 'likes' } }))).toBe('cadb')
        expect(ids(await one({ tool: 'sort', in: { list: 'posts' }, params: { by: 'created_at', direction: 'desc' } }))).toBe('dacb')
        expect(ids(await one({ tool: 'sort', in: { list: 'posts' }, params: { by: 'body' } }))).toBe('abcd')
    })
    test('limit, reverse, first, count, pluck', async () => {
        expect(ids(await one({ tool: 'limit', in: { list: 'posts' }, params: { take: 2, skip: 1 } }))).toBe('bc')
        expect(ids(await one({ tool: 'reverse', in: { list: 'posts' } }))).toBe('dcba')
        expect((await one({ tool: 'first', in: { list: 'posts' } })).id).toBe('a')
        expect(await one({ tool: 'first', in: { list: 'posts' } }, {}, { posts: [] })).toBeNull()
        expect(await one({ tool: 'count', in: { list: 'posts' } })).toBe(4)
        expect(await one({ tool: 'pluck', in: { list: 'posts' }, params: { field: 'user_id' } })).toEqual(['u1', 'u2', 'u1', 'u3'])
    })
    test('merge joins lists in wire order', async () => {
        const extra = { rev: { tool: 'reverse', in: { list: 'posts' } } }
        expect(ids(await one({ tool: 'merge', in: { lists: ['posts', 'rev'] } }, extra))).toBe('abcddcba')
    })
    test('interleave inserts one row of b after every N rows of a', async () => {
        const data = { posts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], packs: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] }
        const extra = {
            pq: { tool: 'query.build', params: { from: 'packs' } },
            packs: { tool: 'query.run', in: { query: 'pq' } },
        }
        expect(ids(await one({ tool: 'interleave', in: { a: 'posts', b: 'packs' }, params: { every: 2 } }, extra, data))).toBe('abxcdy')
    })
    test('dedupe keeps the first row per value', async () => {
        expect(ids(await one({ tool: 'dedupe', in: { list: 'posts' }, params: { by: 'user_id' } }))).toBe('abd')
        const extra = { twice: { tool: 'merge', in: { lists: ['posts', 'posts'] } } }
        expect(ids(await one({ tool: 'dedupe', in: { list: 'twice' } }, extra))).toBe('abcd')
    })
    test('group keeps first-seen order', async () => {
        const groups = await one({ tool: 'group', in: { list: 'posts' }, params: { by: 'user_id' } })
        expect(groups.map((group: any) => [group.key, ids(group.items)])).toEqual([['u1', 'ac'], ['u2', 'b'], ['u3', 'd']])
    })
    test('constants', async () => {
        expect(await one({ tool: 'text', params: { value: 'hi' } })).toBe('hi')
        expect(await one({ tool: 'number', params: { value: 4 } })).toBe(4)
        expect(await one({ tool: 'boolean', params: { value: false } })).toBe(false)
    })
})

describe('filter', () => {
    test('equality', async () => {
        expect(await filter({ parent: null })).toBe('acd')
        expect(await filter({ user_id: 'u1' })).toBe('ac')
        expect(await filter({ user_id: { equals: 'u2' } })).toBe('b')
        expect(await filter({ user_id: { not: 'u1' } })).toBe('bd')
        expect(await filter({ parent: { not: null } })).toBe('b')
        expect(await filter({ user_id: { in: ['u2', 'u3'] } })).toBe('bd')
        expect(await filter({ user_id: { notIn: ['u2', 'u3'] } })).toBe('ac')
    })
    test('comparison', async () => {
        expect(await filter({ likes: { gt: 3 } })).toBe('bd')
        expect(await filter({ likes: { gte: 3, lt: 10 } })).toBe('ad')
        expect(await filter({ created_at: { lte: '2026-01-02' } })).toBe('bc')
    })
    test('text', async () => {
        expect(await filter({ body: { contains: 'world' } })).toBe('')
        expect(await filter({ body: { contains: 'world', mode: 'insensitive' } })).toBe('a')
        expect(await filter({ body: { startsWith: 'th' } })).toBe('c')
        expect(await filter({ body: { endsWith: 'nd' } })).toBe('b')
    })
    test('lists', async () => {
        expect(await filter({ tags: { has: 'art' } })).toBe('ac')
        expect(await filter({ tags: { hasSome: ['wip', 'photo'] } })).toBe('ad')
        expect(await filter({ tags: { hasEvery: ['art', 'wip'] } })).toBe('a')
        expect(await filter({ tags: { isEmpty: true } })).toBe('b')
    })
    test('logic and several fields', async () => {
        expect(await filter({ user_id: 'u1', likes: { gt: 1 } })).toBe('a')
        expect(await filter({ OR: [{ user_id: 'u2' }, { likes: 7 }] })).toBe('bd')
        expect(await filter({ AND: [{ parent: null }, { NOT: { user_id: 'u1' } }] })).toBe('d')
        expect(await filter({ NOT: [{ user_id: 'u1' }, { user_id: 'u2' }] })).toBe('d')
    })
    test('a missing field never matches a value and never reaches the prototype', async () => {
        expect(await filter({ nope: 'x' })).toBe('')
        expect(await filter({ constructor: { not: null } })).toBe('')
    })
})

describe('queries', () => {
    test('query.build substitutes wired values and leaves reader placeholders alone', async () => {
        const fixture = host()
        const boot = script(
            {
                tag: { tool: 'text', params: { value: 'art' } },
                q: {
                    tool: 'query.build',
                    params: {
                        from: 'posts', feed: true, take: 5, orderBy: { created_at: 'desc' },
                        where: { tags: { has: { $value: 'tag' } }, user_id: { in: { $viewer: 'following' } } },
                    },
                    in: { tag: 'tag', page: 'input.page' },
                },
                run: { tool: 'query.run', in: { query: 'q' } },
            },
            { posts: 'run' },
        )
        await runProgram({ boot }, { kind: feedKind, inputs: { page: 1 }, host: fixture.tools })
        expect(fixture.calls).toEqual([
            {
                query: {
                    from: 'posts', feed: true, take: 5, orderBy: { created_at: 'desc' },
                    where: { tags: { has: 'art' }, user_id: { in: { $viewer: 'following' } } },
                    page: 1,
                },
                params: {},
                at: { script: 'boot', node: 'run' },
            },
        ])
    })

    test('a called script gets inputs and returns named outputs', async () => {
        const fixture = host()
        const program: Program = {
            boot: script(
                {
                    n: { tool: 'text', params: { value: '2026-01-02' } },
                    c: { tool: 'call', params: { script: 'top' }, in: { take: 'n' } },
                },
                { posts: 'c.rows', total: 'c.total', at: 'input.page' },
            ),
            top: script(
                {
                    q: { tool: 'query.build', params: { from: 'posts', where: { created_at: { gte: { $value: 'min' } } } }, in: { min: 'input.take' } },
                    run: { tool: 'query.run', in: { query: 'q' } },
                    count: { tool: 'count', in: { list: 'run' } },
                },
                { rows: 'run', total: 'count' },
                { take: 'text' },
            ),
        }
        const result = await runProgram(program, { kind: feedKind, inputs: { page: 3 }, host: fixture.tools })
        expect(result).toEqual({ outputs: { posts: rows, total: 4, at: 3 } })
        expect(fixture.calls).toHaveLength(1)
        expect(fixture.calls[0]!.query.where).toEqual({ created_at: { gte: '2026-01-02' } })
        expect(fixture.calls[0]!.at).toEqual({ script: 'top', node: 'run' })
    })

    test('only what the requested outputs depend on runs', async () => {
        const fixture = host({ posts: rows, packs: [{ id: 'p' }] })
        const boot = script(
            {
                ...source,
                pq: { tool: 'query.build', params: { from: 'packs' } },
                packs: { tool: 'query.run', in: { query: 'pq' } },
                rev: { tool: 'reverse', in: { list: 'posts' } },
                twice: { tool: 'merge', in: { lists: ['rev', 'posts'] } },
            },
            { posts: 'twice', packs: 'packs' },
        )
        const result = await runProgram({ boot }, { kind: feedKind, inputs: { page: 2 }, outputs: ['posts'], host: fixture.tools })
        expect(Object.keys((result as any).outputs)).toEqual(['posts'])
        // `posts` feeds two consumers but runs once; `packs` is never asked for.
        expect(fixture.calls.map((call) => call.query.from)).toEqual(['posts'])
    })

    test('a host value that is not a list passes through to an output', async () => {
        const result = await runProgram(
            { boot: script(source, { posts: 'posts' }) },
            { kind: feedKind, inputs: { page: 1 }, host: host({ posts: { __error: 'Query failed' } }).tools },
        )
        expect(result).toEqual({ outputs: { posts: { __error: 'Query failed' } } })
    })
})

describe('failures come back as problems', () => {
    const run = (boot: ScriptFile, tools: Record<string, HostTool>, kind = feedKind) =>
        runProgram({ boot }, { kind, inputs: { page: 1 }, host: tools }) as Promise<{ problem: any }>

    test('a host failure names the node', async () => {
        const { problem } = await run(script(source, { posts: 'posts' }), {
            'query.run': async () => {
                throw new Error('secret database detail')
            },
        })
        expect(problem).toMatchObject({ script: 'boot', node: 'posts' })
        expect(problem.message).not.toContain('secret')
    })
    test('a missing host tool', async () => {
        const { problem } = await run(script(source, { posts: 'posts' }), {})
        expect(problem).toMatchObject({ script: 'boot', node: 'posts' })
    })
    test('rows that are not a list', async () => {
        const boot = script({ ...source, rev: { tool: 'reverse', in: { list: 'posts' } } }, { out: 'rev' })
        const { problem } = await run(boot, host({ posts: { __error: 'Query failed' } }).tools)
        expect(problem).toMatchObject({ node: 'rev' })
    })
    test('too many rows', async () => {
        const many = Array.from({ length: 2001 }, (_, index) => ({ id: String(index) }))
        const boot = script({ ...source, sorted: { tool: 'sort', in: { list: 'posts' }, params: { by: 'id' } } }, { out: 'sorted' })
        const { problem } = await run(boot, host({ posts: many }).tools)
        expect(problem.node).toBe('sorted')
        expect(problem.message).toContain('2,000')
    })
    test('the step budget', async () => {
        const kind = { ...feedKind, limits: { ...feedKind.limits, steps: 5 } }
        const boot = script({ ...source, rev: { tool: 'reverse', in: { list: 'posts' } } }, { out: 'rev' })
        const { problem } = await run(boot, host().tools, kind)
        expect(problem.message).toContain('too much work')
    })
    test('an invalid program is refused before anything runs', async () => {
        const fixture = host()
        const boot = script({ ...source, bad: { tool: 'nope', in: { list: 'posts' } } }, { out: 'bad' })
        const { problem } = await run(boot, fixture.tools)
        expect(problem).toMatchObject({ node: 'bad' })
        expect(fixture.calls).toHaveLength(0)
    })
})

test('the same inputs give the same outputs', async () => {
    const boot = script(
        { ...source, g: { tool: 'group', in: { list: 'posts' }, params: { by: 'user_id' } } },
        { groups: 'g' },
    )
    const once = await runProgram({ boot }, { kind: feedKind, inputs: { page: 1 }, host: host().tools })
    const twice = await runProgram({ boot }, { kind: feedKind, inputs: { page: 1 }, host: host().tools })
    expect(once).toEqual(twice)
})

describe('trace and probe', () => {
    type Seen = { at: TraceAt; result: TraceResult }
    const collect = () => {
        const seen: Seen[] = []
        return { seen, trace: (at: TraceAt, result: TraceResult) => void seen.push({ at, result }) }
    }
    const limited = { ...source, top: { tool: 'limit', in: { list: 'posts' }, params: { take: 2 } } }

    test('trace reports each node once with its value', async () => {
        const { seen, trace } = collect()
        await runProgram({ boot: script(limited, { a: 'top', b: 'top' }) }, { kind: feedKind, inputs: { page: 1 }, host: host().tools, trace })
        expect(seen.map((entry) => entry.at.node).sort()).toEqual(['posts', 'q', 'top'])
        expect(seen.every((entry) => entry.at.script === 'boot' && entry.at.via.length === 0)).toBe(true)
        expect(seen.find((entry) => entry.at.node === 'posts')!.result).toEqual({ value: rows })
        expect(ids((seen.find((entry) => entry.at.node === 'top')!.result as { value: any }).value)).toBe('ab')
    })
    test('trace reports via for a called script', async () => {
        const { seen, trace } = collect()
        const program: Program = {
            boot: script({ sub: { tool: 'call', params: { script: 'art' } } }, { out: 'sub.posts' }),
            art: script(source, { posts: 'posts' }),
        }
        await runProgram(program, { kind: feedKind, inputs: { page: 1 }, host: host().tools, trace })
        const inner = seen.filter((entry) => entry.at.script === 'art')
        expect(inner.map((entry) => entry.at.node).sort()).toEqual(['posts', 'q'])
        expect(inner.every((entry) => entry.at.via.join() === 'boot.sub')).toBe(true)
        const call = seen.find((entry) => entry.at.script === 'boot' && entry.at.node === 'sub')!
        expect(call.at.output).toBe('posts')
        expect(call.result).toEqual({ value: rows })
    })
    test('a failing host tool is traced as a problem and earlier values are kept', async () => {
        const { seen, trace } = collect()
        const result = await runProgram(
            { boot: script(source, { out: 'posts' }) },
            { kind: feedKind, inputs: { page: 1 }, host: { 'query.run': async () => Promise.reject(new Error('down')) }, trace },
        )
        expect('problem' in result).toBe(true)
        expect('value' in seen.find((entry) => entry.at.node === 'q')!.result).toBe(true)
        expect(seen.find((entry) => entry.at.node === 'posts')!.result).toEqual({
            problem: { script: 'boot', node: 'posts', path: 'nodes.posts', message: 'Run query failed.' },
        })
    })
    const dangling = { ...source, n: { tool: 'count', in: { list: 'posts' } } }
    test('probe runs nodes nothing reads', async () => {
        const plain = collect()
        await runProgram({ boot: script(dangling, { out: 'posts' }) }, { kind: feedKind, inputs: { page: 1 }, host: host().tools, trace: plain.trace })
        expect(plain.seen.some((entry) => entry.at.node === 'n')).toBe(false)
        const probed = collect()
        await runProgram(
            { boot: script(dangling, { out: 'posts' }) },
            { kind: feedKind, inputs: { page: 1 }, host: host().tools, trace: probed.trace, probe: 'boot' },
        )
        expect(probed.seen.find((entry) => entry.at.node === 'n')!.result).toEqual({ value: 4 })
    })
    test('probe runs the unread nodes of a called script', async () => {
        const { seen, trace } = collect()
        const program: Program = {
            boot: script({ sub: { tool: 'call', params: { script: 'art' } } }, { out: 'sub.posts' }),
            art: script(dangling, { posts: 'posts' }),
        }
        await runProgram(program, { kind: feedKind, inputs: { page: 1 }, host: host().tools, trace, probe: 'art' })
        expect(seen.find((entry) => entry.at.script === 'art' && entry.at.node === 'n')!.result).toEqual({ value: 4 })
    })
    test('a failing probed node does not fail the run', async () => {
        const { seen, trace } = collect()
        const result = await runProgram(
            { boot: script({ ...source, n: { tool: 'count', in: { list: 'posts' } } }, { out: 'q' }) },
            { kind: feedKind, inputs: { page: 1 }, host: { 'query.run': async () => Promise.reject(new Error('down')) }, trace, probe: 'boot' },
        )
        expect('outputs' in result).toBe(true)
        expect('problem' in seen.find((entry) => entry.at.node === 'posts')!.result).toBe(true)
    })
    test('without a probe, a failure does not wait for the other outputs', async () => {
        const two = {
            ...source,
            pq: { tool: 'query.build', params: { from: 'packs' } },
            packs: { tool: 'query.run', in: { query: 'pq' } },
        }
        const run: HostTool = (inputs) =>
            (inputs.query as { from: string }).from === 'posts' ? Promise.reject(new Error('down')) : new Promise(() => {})
        const result = await Promise.race([
            runProgram({ boot: script(two, { a: 'posts', b: 'packs' }) }, { kind: feedKind, inputs: { page: 1 }, host: { 'query.run': run } }),
            new Promise((resolve) => setTimeout(() => resolve('still waiting'), 200)),
        ])
        expect(result).toEqual({ problem: { script: 'boot', node: 'posts', path: 'nodes.posts', message: 'Run query failed.' } })
    })
    test('a trace that throws does not change the result', async () => {
        const result = await runProgram(
            { boot: script(source, { out: 'posts' }) },
            { kind: feedKind, inputs: { page: 1 }, host: host().tools, trace: () => { throw new Error('boom') } },
        )
        expect(result).toEqual({ outputs: { out: rows } })
    })
})
