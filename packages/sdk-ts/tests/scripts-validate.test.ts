import { describe, expect, test } from 'bun:test'
import {
    accepts, describeNode, feedKind, parseScript, reachableQueries, themeKind, TOOLS, validateProgram,
    type Program, type ScriptFile, type ScriptNode, SCRIPT_FILE, scriptName, scriptPath, pagedOutputs } from '../src/scripts'

const script = (
    nodes: Record<string, ScriptNode>,
    outputs: Record<string, string> = {},
    inputs?: ScriptFile['inputs'],
): ScriptFile => ({ version: 1, ...(inputs ? { inputs } : {}), nodes, outputs })

const build = (extra: Record<string, unknown> = {}): ScriptNode => ({
    tool: 'query.build',
    params: { from: 'posts', where: { parent: null }, orderBy: { created_at: 'desc' }, take: 30, ...extra },
})
const run = (query = 'build'): ScriptNode => ({
    tool: 'query.run',
    in: { query },
})
const basic = (): Program => ({
    boot: script({ build: build(), run: run('build') }, { posts: 'run' }),
})
const problems = (program: Record<string, unknown>, kind = feedKind) => validateProgram(program, kind)
const only = (program: Record<string, unknown>, kind = feedKind) => {
    const found = problems(program, kind)
    expect(found.map((problem) => problem.message)).toHaveLength(1)
    return found[0]!
}

describe('catalogue', () => {
    test('describes every tool the spec names', () => {
        expect(TOOLS.map((tool) => tool.id).sort()).toEqual([
            'boolean', 'call', 'count', 'dedupe', 'filter', 'first', 'group', 'interleave', 'limit',
            'merge', 'number', 'pluck', 'query.build', 'query.run', 'reverse', 'sort', 'text',
        ])
        const byId = Object.fromEntries(TOOLS.map((tool) => [tool.id, tool]))
        expect(byId['query.run']!.host).toBe(true)
        expect(['filter', 'limit', 'dedupe'].every((id) => byId[id]!.dropsRows)).toBe(true)
        expect(byId.sort!.dropsRows).toBeUndefined()
        for (const tool of TOOLS) expect(tool.label && tool.description).toBeTruthy()
    })

    test('port compatibility', () => {
        expect(accepts('list<posts>', 'list<any>')).toBe(true)
        expect(accepts('list<posts>', 'list<posts>')).toBe(true)
        expect(accepts('list<any>', 'list<posts>')).toBe(false)
        expect(accepts('list<posts>', 'number')).toBe(false)
        expect(accepts('query<posts>', 'query<any>')).toBe(true)
        expect(accepts('text', 'any')).toBe(true)
    })
})

describe('parseScript', () => {
    test('rejects invalid JSON and wrong shapes with a problem', () => {
        expect(parseScript('{', 'boot')).toMatchObject({ problem: { script: 'boot' } })
        expect(parseScript('[]', 'boot')).toMatchObject({ problem: { script: 'boot' } })
        expect(parseScript('{"version":2,"nodes":{},"outputs":{}}', 'boot')).toMatchObject({
            problem: { path: 'version' },
        })
    })
    test('returns the file', () => {
        expect(parseScript(JSON.stringify(basic().boot), 'boot')).toEqual({ file: basic().boot! })
    })
})

describe('validateProgram', () => {
    test('accepts a valid two-script program', () => {
        const program: Program = {
            boot: script(
                { art: { tool: 'call', params: { script: 'art' }, in: { tag: 'tag' } }, tag: { tool: 'text', params: { value: 'art' } } },
                { posts: 'art.posts' },
            ),
            art: script(
                {
                    build: { ...build({ where: { tags: { has: { $value: 'tag' } } } }), in: { tag: 'input.tag' } },
                    run: run('build'),
                },
                { posts: 'run' },
                { tag: 'text' },
            ),
        }
        expect(problems(program)).toEqual([])
    })

    test('never throws on arbitrary input', () => {
        for (const value of [null, 1, 'x', [], { boot: null }, { boot: { version: 1, nodes: [], outputs: 3 } }])
            expect(Array.isArray(validateProgram(value as never, feedKind))).toBe(true)
    })

    test('missing boot', () => {
        expect(only({ art: basic().boot })).toMatchObject({ script: 'boot' })
        expect(only({ art: basic().boot }).message).toContain('scripts/boot.ruff')
    })

    test('unknown tool', () => {
        const found = only({ boot: script({ x: { tool: 'shuffle' } }) })
        expect(found).toMatchObject({ script: 'boot', node: 'x', path: 'nodes.x.tool' })
        expect(found.message).toContain('shuffle')
    })

    test('wire to a missing node', () => {
        const found = only({ boot: script({ run: run('nope') }, {}) })
        expect(found).toMatchObject({ script: 'boot', node: 'run', path: 'nodes.run.in.query' })
        expect(found.message).toContain('nope')
    })

    test('mistyped wire', () => {
        const program = basic()
        program.boot!.nodes.limit = { tool: 'limit', in: { list: 'count' }, params: { take: 1 } }
        program.boot!.nodes.count = { tool: 'count', in: { list: 'run' } }
        const found = only(program)
        expect(found).toMatchObject({ node: 'limit', path: 'nodes.limit.in.list' })
        expect(found.message).toContain('number')
    })

    test('a typed list fits a general list port, and keeps its type', () => {
        const program = basic()
        program.boot!.nodes.keep = { tool: 'filter', in: { list: 'run' }, params: { where: { parent: null } } }
        program.boot!.outputs.posts = 'keep'
        expect(problems(program)).toEqual([])
        expect(describeNode(program, 'boot', 'keep', feedKind).outputs[0]!.type).toBe('list<posts>')
    })

    test('cycle inside a script', () => {
        const found = problems({
            boot: script({
                a: { tool: 'reverse', in: { list: 'b' } },
                b: { tool: 'reverse', in: { list: 'a' } },
            }),
        })
        expect(found.length).toBeGreaterThan(0)
        expect(found.every((problem) => problem.message.includes('loop'))).toBe(true)
    })

    test('recursive calls', () => {
        const call = (name: string): ScriptFile => script({ c: { tool: 'call', params: { script: name } } })
        const found = problems({ boot: call('a'), a: call('boot') })
        expect(found.some((problem) => problem.message.includes('calls itself'))).toBe(true)
    })

    test('call to a missing script', () => {
        const found = only({ boot: script({ c: { tool: 'call', params: { script: 'art' } } }) })
        expect(found).toMatchObject({ script: 'boot', node: 'c' })
        expect(found.message).toContain('scripts/art.ruff does not exist')
    })

    test('node limit', () => {
        const nodes = Object.fromEntries(
            Array.from({ length: 33 }, (_, index) => [`n${index}`, { tool: 'number', params: { value: index } }]),
        )
        expect(only({ boot: script(nodes) }).message).toContain('32')
    })

    test('query limit counts through calls', () => {
        const four = script(
            Object.fromEntries(
                [0, 1, 2, 3].flatMap((index) => [
                    [`b${index}`, build()],
                    [`r${index}`, run(`b${index}`)],
                ]),
            ),
            { a: 'r0', b: 'r1', c: 'r2', d: 'r3' },
        )
        const program = {
            boot: script(
                { one: { tool: 'call', params: { script: 'four' } }, two: { tool: 'call', params: { script: 'four' } } },
                { a: 'one.a', b: 'one.b', c: 'one.c', d: 'one.d', e: 'two.a', f: 'two.b', g: 'two.c', h: 'two.d' },
            ),
            four,
        }
        expect(reachableQueries(program)).toHaveLength(8)
        const found = only(program)
        expect(found.message).toContain('6')
        expect(found.message).toContain('8')
    })

    test('reachable queries follow only the requested outputs', () => {
        const program = basic()
        program.boot!.nodes.b2 = build({ from: 'packs', where: {}, orderBy: undefined })
        program.boot!.nodes.r2 = run('b2')
        program.boot!.outputs.packs = 'r2'
        expect(reachableQueries(program)).toHaveLength(2)
        expect(reachableQueries(program, ['posts'])).toEqual([{ script: 'boot', node: 'run' }])
    })

    test('a query pages when a page number is wired into it', () => {
        const paged = basic()
        paged.boot!.nodes.build = { ...paged.boot!.nodes.build!, in: { page: 'input.page' } }
        expect(validateProgram(paged, feedKind)).toEqual([])
        expect(describeNode(paged, 'boot', 'build', feedKind).inputs[0]).toEqual({ name: 'page', label: 'Page', type: 'number', optional: true })
        // A theme's page is its name, which is not a number to page by.
        const [found] = validateProgram(paged, themeKind)
        expect(found!.node).toBe('build')
        expect(found!.path).toBe('nodes.build.in.page')
        // Several queries may page together.
        paged.boot!.nodes.b2 = { ...build({ from: 'packs', where: {}, orderBy: undefined }), in: { page: 'input.page' } }
        paged.boot!.nodes.r2 = run('b2')
        paged.boot!.outputs.packs = 'r2'
        expect(validateProgram(paged, feedKind)).toEqual([])
    })

    test('a value in the filters cannot be called page', () => {
        const program = basic()
        program.boot!.nodes.build = { ...build({ where: { tags: { has: { $value: 'page' } } } }), in: { page: 'input.page' } }
        expect(only(program).message).toContain('page')
    })

    test('the outputs that load more are the ones that depend on the page', () => {
        const program: Program = {
            boot: {
                version: 1,
                nodes: {
                    build: { tool: 'query.build', params: { from: 'posts' }, in: { page: 'input.page' } },
                    run: { tool: 'query.run', in: { query: 'build' } },
                    top: { tool: 'limit', in: { list: 'run' }, params: { take: 3 } },
                    pb: { tool: 'query.build', params: { from: 'packs' } },
                    packs: { tool: 'query.run', in: { query: 'pb' } },
                    more: { tool: 'call', params: { script: 'more' }, in: { at: 'input.page' } },
                    same: { tool: 'call', params: { script: 'more' }, in: { at: 'one' } },
                    one: { tool: 'number', params: { value: 1 } },
                },
                outputs: { posts: 'run', top: 'top', packs: 'packs', deep: 'more.rows', still: 'same.rows', where: 'input.page', fixed: 'more.fixed' },
            },
            more: {
                version: 1,
                inputs: { at: 'number' },
                nodes: {
                    build: { tool: 'query.build', params: { from: 'posts' }, in: { page: 'input.at' } },
                    run: { tool: 'query.run', in: { query: 'build' } },
                    pb: { tool: 'query.build', params: { from: 'packs' } },
                    packs: { tool: 'query.run', in: { query: 'pb' } },
                },
                outputs: { rows: 'run', fixed: 'packs' },
            },
        }
        expect(pagedOutputs(program, feedKind)).toEqual(['posts', 'top', 'deep', 'where'])
        expect(pagedOutputs(basic(), feedKind)).toEqual([])
        expect(pagedOutputs({}, feedKind)).toEqual([])
    })

    test('an output cannot take the name of something templates already receive', () => {
        const program = basic()
        program.boot!.outputs.hasMore = 'run'
        const found = only(program)
        expect(found.path).toBe('outputs.hasMore')
        expect(found.message).toContain('hasMore')
        expect(validateProgram(program, themeKind).some((problem) => problem.path === 'outputs.hasMore')).toBe(false)
        const themed = basic()
        themed.boot!.outputs.owner = 'run'
        expect(validateProgram(themed, themeKind).some((problem) => problem.path === 'outputs.owner')).toBe(true)
        // Only what the host runs directly feeds templates: a called script may name outputs freely.
        const called = basic()
        called.side = { version: 1, nodes: { n: { tool: 'number', params: { value: 1 } } }, outputs: { page: 'n' } }
        called.boot!.nodes.c = { tool: 'call', params: { script: 'side' } }
        called.boot!.outputs.n = 'c.page'
        expect(validateProgram(called, feedKind)).toEqual([])
    })

    test('$value needs a wire', () => {
        const program = basic()
        program.boot!.nodes.build = build({ where: { tags: { has: { $value: 'tag' } } } })
        const found = only(program)
        expect(found).toMatchObject({ node: 'build' })
        expect(found.message).toContain('tag')
    })

    test('$viewer is allowed in a query and refused in a filter', () => {
        const program = basic()
        program.boot!.nodes.build = build({ where: { user_id: { in: { $viewer: 'following' } } } })
        expect(problems(program)).toEqual([])
        program.boot!.nodes.keep = {
            tool: 'filter', in: { list: 'run' }, params: { where: { user_id: { in: { $viewer: 'following' } } } },
        }
        expect(only(program)).toMatchObject({ node: 'keep' })
        program.boot!.nodes.build = build({ where: { user_id: { $viewer: 'everyone' } } })
        delete program.boot!.nodes.keep
        expect(only(program).message).toContain('everyone')
    })

    test('query fields, operators and take', () => {
        const check = (extra: Record<string, unknown>) => {
            const program = basic()
            program.boot!.nodes.build = build(extra)
            return only(program)
        }
        expect(check({ where: { nope: 1 } }).message).toContain('nope')
        expect(check({ where: { body: { matches: 'x' } } }).message).toContain('matches')
        expect(check({ where: { network_rank: 1 } }).message).toContain('network_rank')
        expect(check({ orderBy: { tags: 'up' } }).path).toBe('nodes.build.params.orderBy')
        expect(check({ take: 201 }).message).toContain('200')
        expect(check({ from: 'things' }).path).toBe('nodes.build.params.from')
        expect(check({ extra: true }).path).toBe('nodes.build.params.extra')
        const ok = basic()
        ok.boot!.nodes.build = build({ where: { OR: [{ tags: { has: 'a' } }, { NOT: { body: { contains: 'x', mode: 'insensitive' } } }] }, orderBy: [{ network_rank: 'asc' }] })
        expect(problems(ok)).toEqual([])
    })

    test('names', () => {
        const output = basic()
        output.boot!.outputs = { 'my posts': 'run' }
        expect(only(output).path).toBe('outputs.my posts')
        const node = script({ 'a.b': { tool: 'number', params: { value: 1 } } })
        expect(only({ boot: node }).path).toBe('nodes.a.b')
    })

    test('boot gets the kind inputs without declaring them', () => {
        const program = basic()
        program.boot!.nodes.n = { tool: 'limit', in: { list: 'run' }, params: { take: 2 } }
        program.boot!.outputs.at = 'input.page'
        expect(problems(program)).toEqual([])
        program.boot!.outputs.other = 'input.other'
        expect(only(program).path).toBe('outputs.other')
    })
})

describe('describeNode', () => {
    test('a call node has the callee ports', () => {
        const program: Program = {
            boot: script({ c: { tool: 'call', params: { script: 'art' } } }),
            art: script({ n: { tool: 'number', params: { value: 1 } } }, { total: 'n' }, { tag: 'text' }),
        }
        const ports = describeNode(program, 'boot', 'c', feedKind)
        expect(ports.inputs).toEqual([{ name: 'tag', label: 'tag', type: 'text' }])
        expect(ports.outputs).toEqual([{ name: 'total', label: 'total', type: 'number' }])
    })
    test('a query node has one input per $value and a typed output', () => {
        const program = basic()
        program.boot!.nodes.build = build({ from: 'packs', where: { id: { in: { $value: 'ids' } } }, orderBy: undefined })
        const ports = describeNode(program, 'boot', 'build', feedKind)
        expect(ports.inputs.map((port) => port.name)).toEqual(['page', 'ids'])
        expect(ports.outputs[0]!.type).toBe('query<packs>')
        expect(describeNode(program, 'boot', 'run', feedKind).outputs[0]!.type).toBe('list<packs>')
    })
})

test('a script is named by its file, and its file by its name', () => {
    expect(scriptName('scripts/boot.ruff')).toBe('boot')
    expect(scriptName('scripts/top-10.ruff')).toBe('top-10')
    expect(scriptName('scripts/nested/a.ruff')).toBeUndefined()
    expect(scriptName('scripts/1st.ruff')).toBeUndefined()
    expect(scriptName('meta.json')).toBeUndefined()
    expect(scriptPath('boot')).toBe('scripts/boot.ruff')
    expect(SCRIPT_FILE.test(scriptPath('a_b'))).toBe(true)
})
