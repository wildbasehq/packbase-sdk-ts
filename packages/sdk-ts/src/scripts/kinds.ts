import { TOOLS } from './tools'
import type { Program, ScriptKind, ScriptLimits, ScriptProblem } from './types'
import { reachableNodes } from './validate'

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
export function reachableQueries(
    program: Program,
    outputs?: string[],
    entry = 'boot',
): { script: string; node: string; paged: boolean }[] {
    return reachableNodes(program, entry, outputs)
        .filter((reached) => reached.tool === 'query.run')
        .map(({ script, node, params }) => ({ script, node, paged: params.paged === true }))
}

/** The rules searching adds to a kind: a cap on queries, and how many of them may page. */
function queryRules(paged: 0 | 1) {
    return (program: Program): ScriptProblem[] => {
        const problems: ScriptProblem[] = []
        const queries = reachableQueries(program)
        if (queries.length > MAX_QUERIES)
            problems.push({
                script: 'boot',
                path: 'nodes',
                message: `This program runs ${queries.length} queries; the limit is ${MAX_QUERIES}.`,
            })
        const pages = queries.filter((query) => query.paged)
        if (paged === 0)
            for (const query of pages)
                problems.push({
                    script: query.script,
                    node: query.node,
                    path: `nodes.${query.node}.params.paged`,
                    message: 'Only feeds have pages. Turn off paged on this query.',
                })
        else if (pages.length > 1) {
            const extra = pages[1]!
            problems.push({
                script: extra.script,
                node: extra.node,
                path: `nodes.${extra.node}.params.paged`,
                message: 'A feed pages through one paged query. Turn off paged on the others.',
            })
        }
        return problems
    }
}

/** A custom feed: `boot` gets the page number and may page one posts query. */
export const feedKind: ScriptKind = {
    id: 'feed',
    entries: { boot: { page: 'number' } },
    required: ['boot'],
    tools: TOOLS,
    limits: DEFAULT_SCRIPT_LIMITS,
    check: queryRules(1),
}

/** A profile or pack theme: `boot` gets the name of the page being rendered. */
export const themeKind: ScriptKind = {
    id: 'theme',
    entries: { boot: { page: 'text' } },
    required: ['boot'],
    tools: TOOLS,
    limits: DEFAULT_SCRIPT_LIMITS,
    check: queryRules(0),
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
