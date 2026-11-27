import { TOOLS } from './tools'
import type { Program, ScriptKind, ScriptLimits, ScriptProblem } from './types'
import { CALL, reachableNodes, splitRef, wires } from './validate'

export const DEFAULT_SCRIPT_LIMITS: ScriptLimits = {
    scripts: 16,
    nodes: 32,
    depth: 8,
    outputs: 12,
    rows: 2000,
    steps: 100_000,
}

/** How many queries one run may reach: the search request's own cap, less the run itself. */
export const MAX_QUERIES = 6

/**
 * Every `query.run` a run of an entry script reaches for the given outputs (all by default),
 * once per time it runs: a script called twice counts its queries twice.
 */
export function reachableQueries(program: Program, outputs?: string[], entry = 'boot'): { script: string; node: string }[] {
    return reachableNodes(program, entry, outputs)
        .filter((reached) => reached.tool === 'query.run')
        .map(({ script, node }) => ({ script, node }))
}

/**
 * The rules a kind whose scripts feed templates adds: a cap on queries, and names its entry
 * script's outputs cannot take because templates already receive something by that name.
 */
function templateRules(entry: string, reserved: readonly string[]) {
    return (program: Program): ScriptProblem[] => {
        const problems: ScriptProblem[] = []
        const queries = reachableQueries(program, undefined, entry)
        if (queries.length > MAX_QUERIES)
            problems.push({
                script: entry,
                path: 'nodes',
                message: `This program runs ${queries.length} queries; the limit is ${MAX_QUERIES}.`,
            })
        for (const name of Object.keys(program[entry]?.outputs ?? {}))
            if (reserved.includes(name))
                problems.push({
                    script: entry,
                    path: `outputs.${name}`,
                    message: `Templates already receive something called “${name}”. Give this output another name.`,
                })
        return problems
    }
}

/** What a feed's templates receive besides its boot outputs. */
export const FEED_CONTEXT = ['feed', 'viewer', 'page', 'hasMore'] as const
/** What a theme page's templates receive besides its boot outputs. */
export const THEME_CONTEXT = ['owner', 'page', 'viewer'] as const

/**
 * The outputs of a kind's entry script that change with the page it is given: every output
 * that `input.page` reaches, through other nodes and through called scripts. These are what
 * a later page has to compute again; the rest are the same on every page.
 */
export function pagedOutputs(program: Program, kind: ScriptKind): string[] {
    const entry = kind.required[0] ?? 'boot'
    /** Whether a wire in a script depends on one of the inputs marked as carrying the page. */
    const depends = (script: string, ref: string, carries: ReadonlySet<string>, depth: number): boolean => {
        const file = program[script]
        if (!file || depth > 32) return false
        const { node: id, output } = splitRef(ref)
        if (id === 'input') return output !== undefined && carries.has(output)
        const node = file.nodes[id]
        if (!node) return false
        const wired = (port: string) => wires(node, port).some((wire) => depends(script, wire, carries, depth + 1))
        if (node.tool !== CALL) return Object.keys(node.in ?? {}).some(wired)
        const callee = node.params?.script
        const target = typeof callee === 'string' && output !== undefined ? program[callee]?.outputs[output] : undefined
        if (typeof callee !== 'string' || target === undefined) return false
        return depends(callee, target, new Set(Object.keys(node.in ?? {}).filter(wired)), depth + 1)
    }
    return Object.entries(program[entry]?.outputs ?? {})
        .filter(([, ref]) => depends(entry, ref, new Set(['page']), 0))
        .map(([name]) => name)
}

/** A custom feed: `boot` gets the page number, and a query it is wired into returns that page. */
export const feedKind: ScriptKind = {
    id: 'feed',
    entries: { boot: { page: 'number' } },
    required: ['boot'],
    tools: TOOLS,
    limits: DEFAULT_SCRIPT_LIMITS,
    check: templateRules('boot', FEED_CONTEXT),
}

/** A profile or pack theme: `boot` gets the name of the page being rendered. Themes do not page. */
export const themeKind: ScriptKind = {
    id: 'theme',
    entries: { boot: { page: 'text' } },
    required: ['boot'],
    tools: TOOLS,
    limits: DEFAULT_SCRIPT_LIMITS,
    check: templateRules('boot', THEME_CONTEXT),
}

/** A copy without canvas positions, which is what an artifact stores. */
export function stripLayout(program: Program): Program {
    return Object.fromEntries(
        Object.entries(program).map(([name, file]) => [
            name,
            {
                ...file,
                nodes: Object.fromEntries(
                    Object.entries(file.nodes).map(([id, { at: _at, ...node }]) => [id, node]),
                ),
            },
        ]),
    )
}
