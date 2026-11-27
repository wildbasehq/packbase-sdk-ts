import { expect, test } from 'bun:test'
import { feedKind, reachableQueries, stripLayout, validateProgram, type Program } from '../src/scripts'

const program: Program = {
    boot: {
        version: 1,
        nodes: {
            posts_query: { tool: 'query.build', params: { from: 'posts', take: 30 }, at: [80, 80] },
            posts: { tool: 'query.run', in: { query: 'posts_query' }, params: { paged: true }, at: [400, 80] },
        },
        outputs: { posts: 'posts' },
    },
}

test('stripLayout removes only positions', () => {
    const stripped = stripLayout(program)
    expect(Object.values(stripped.boot!.nodes).every((node) => node.at === undefined)).toBe(true)
    expect(stripped.boot!.nodes.posts).toEqual({ tool: 'query.run', in: { query: 'posts_query' }, params: { paged: true } })
    expect(program.boot!.nodes.posts!.at).toBeDefined()
    expect(validateProgram(stripped, feedKind)).toEqual([])
})

test('reachable queries can start from any entry script', () => {
    expect(reachableQueries(program)).toEqual([{ script: 'boot', node: 'posts', paged: true }])
    expect(reachableQueries(program, undefined, 'other')).toEqual([])
})
