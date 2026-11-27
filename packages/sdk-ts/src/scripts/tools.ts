import { FILTER_OPERATORS, SEARCH_FIELDS, SEARCH_MODELS, VIEWER_KEYS, type ModelName, type SearchField } from '../search'
import type { ScriptNode, ToolDefinition, ToolPort } from './types'
import { CALL, isRecord, NODE_NAME } from './validate'

// ---------------------------------------------------------------------------
// Search conditions
// ---------------------------------------------------------------------------

const OPERATORS = new Set<string>(Object.values(FILTER_OPERATORS).flat())
const LOGICAL = new Set(['AND', 'OR', 'NOT'])
type Report = (message: string) => void

/** Names a `where` refers to as `{ "$value": name }`, in first-seen order. */
export function valueNames(where: unknown, found: string[] = []): string[] {
    if (Array.isArray(where)) for (const entry of where) valueNames(entry, found)
    else if (isRecord(where)) {
        if (typeof where.$value === 'string') {
            if (!found.includes(where.$value)) found.push(where.$value)
        } else for (const entry of Object.values(where)) valueNames(entry, found)
    }
    return found
}

function modelOf(node: ScriptNode): ModelName | 'any' {
    const from = node.params?.from
    return (SEARCH_MODELS as readonly unknown[]).includes(from) ? (from as ModelName) : 'any'
}

function checkWhere(
    where: unknown,
    options: { fields?: readonly SearchField[]; model?: string; placeholders: boolean },
    report: Report,
): boolean {
    if (!isRecord(where)) {
        report('Conditions must be an object of fields to values.')
        return false
    }
    for (const [key, value] of Object.entries(where)) {
        if (LOGICAL.has(key)) {
            const clauses = Array.isArray(value) ? value : [value]
            if (key !== 'NOT' && !Array.isArray(value)) {
                report(`${key} takes a list of conditions.`)
                return false
            }
            for (const clause of clauses) if (!checkWhere(clause, options, report)) return false
            continue
        }
        if (options.fields && !options.fields.some((field) => field.name === key && field.filter)) {
            report(`${key} is not a field you can filter ${options.model} by.`)
            return false
        }
        if (!checkValue(value, options.placeholders, report, 0)) return false
    }
    return true
}

function checkValue(value: unknown, placeholders: boolean, report: Report, depth: number): boolean {
    if (depth > 8) {
        report('Conditions are nested too deeply.')
        return false
    }
    if (Array.isArray(value)) return value.every((entry) => checkValue(entry, placeholders, report, depth + 1))
    if (!isRecord(value)) return true
    if ('$viewer' in value || '$value' in value) {
        if (!placeholders) {
            report('Reader placeholders and wired values only work in a query.')
            return false
        }
        if (Object.keys(value).length !== 1) {
            report('A placeholder cannot be combined with other keys.')
            return false
        }
        if ('$viewer' in value && !(VIEWER_KEYS as readonly unknown[]).includes(value.$viewer)) {
            report(`Unknown reader placeholder ${JSON.stringify(value.$viewer)}.`)
            return false
        }
        if ('$value' in value && !(typeof value.$value === 'string' && NODE_NAME.test(value.$value))) {
            report('A wired value needs a name made of letters, digits or underscores.')
            return false
        }
        return true
    }
    for (const [operator, operand] of Object.entries(value)) {
        if (!OPERATORS.has(operator)) {
            report(`Unknown operator ${JSON.stringify(operator)}.`)
            return false
        }
        if (!checkValue(operand, placeholders, report, depth + 1)) return false
    }
    return true
}

function checkOrderBy(orderBy: unknown, fields: readonly SearchField[] | undefined, model: string, report: Report) {
    const clauses = Array.isArray(orderBy) ? orderBy : [orderBy]
    for (const clause of clauses) {
        if (!isRecord(clause) || Object.keys(clause).length !== 1)
            return report('Each order names one field with "asc" or "desc".')
        const [field, direction] = Object.entries(clause)[0]!
        if (fields && !fields.some((entry) => entry.name === field && entry.order))
            return report(`${field} is not a field you can order ${model} by.`)
        if (direction !== 'asc' && direction !== 'desc')
            return report('Each order names one field with "asc" or "desc".')
    }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

const field = (row: unknown, name: string): unknown =>
    isRecord(row) && Object.hasOwn(row, name) ? row[name] : undefined
const has = (row: unknown, name: string) => isRecord(row) && Object.hasOwn(row, name)

function equal(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((entry, index) => equal(entry, b[index]))
    return a === b
}

function compare(a: unknown, b: unknown): number | undefined {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
    return undefined
}

function test(value: unknown, condition: unknown): boolean {
    if (!isRecord(condition)) return equal(value, condition)
    const insensitive = condition.mode === 'insensitive'
    const text = (entry: unknown) => (typeof entry === 'string' ? (insensitive ? entry.toLowerCase() : entry) : undefined)
    return Object.entries(condition).every(([operator, operand]) => {
        const order = compare(value, operand)
        switch (operator) {
            case 'equals':
                return equal(value, operand)
            case 'not':
                return !test(value, operand)
            case 'in':
                return Array.isArray(operand) && operand.some((entry) => equal(value, entry))
            case 'notIn':
                return Array.isArray(operand) && !operand.some((entry) => equal(value, entry))
            case 'lt':
                return order !== undefined && order < 0
            case 'lte':
                return order !== undefined && order <= 0
            case 'gt':
                return order !== undefined && order > 0
            case 'gte':
                return order !== undefined && order >= 0
            case 'contains':
            case 'startsWith':
            case 'endsWith': {
                const subject = text(value)
                const part = text(operand)
                if (subject === undefined || part === undefined) return false
                return operator === 'contains'
                    ? subject.includes(part)
                    : operator === 'startsWith'
                      ? subject.startsWith(part)
                      : subject.endsWith(part)
            }
            case 'has':
                return Array.isArray(value) && value.some((entry) => equal(entry, operand))
            case 'hasSome':
                return Array.isArray(value) && Array.isArray(operand) && operand.some((entry) => value.includes(entry))
            case 'hasEvery':
                return Array.isArray(value) && Array.isArray(operand) && operand.every((entry) => value.includes(entry))
            case 'isEmpty':
                return Array.isArray(value) && (value.length === 0) === operand
            case 'mode':
                return true
            default:
                return false
        }
    })
}

/** Whether a row satisfies in-memory conditions written in the search filter grammar. */
export function matches(row: unknown, where: unknown): boolean {
    if (!isRecord(where)) return false
    return Object.entries(where).every(([key, condition]) => {
        if (key === 'AND') return Array.isArray(condition) && condition.every((clause) => matches(row, clause))
        if (key === 'OR') return Array.isArray(condition) && condition.some((clause) => matches(row, clause))
        if (key === 'NOT') return (Array.isArray(condition) ? condition : [condition]).every((clause) => !matches(row, clause))
        // A row without the field matches nothing, including `not`.
        return has(row, key) && test(field(row, key), condition)
    })
}

function substitute(where: unknown, values: Record<string, unknown>): unknown {
    if (Array.isArray(where)) return where.map((entry) => substitute(entry, values))
    if (!isRecord(where)) return where
    if (typeof where.$value === 'string') return values[where.$value]
    return Object.fromEntries(Object.entries(where).map(([key, entry]) => [key, substitute(entry, values)]))
}

const key = (value: unknown) => (typeof value === 'string' ? `s${value}` : JSON.stringify(value) ?? 'undefined')

const list = (name = 'list', label = 'Rows'): ToolPort => ({ name, label, type: 'list<any>' })
const same = (like = 'list'): ToolPort => ({ name: 'out', label: 'Rows', type: 'list<any>', like })

/** Every built-in tool, described well enough for an editor to draw its node and inspector. */
/** A query's page: wire a number into it, such as the page a feed's boot is given, and the query returns that page of its rows. */
const PAGE: ToolPort = { name: 'page', label: 'Page', type: 'number', optional: true }

export const TOOLS: readonly ToolDefinition[] = [
    {
        id: 'query.build',
        ports: (node) => ({
            inputs: [PAGE, ...valueNames(node.params?.where).map((name) => ({ name, label: name, type: 'any' }))],
            outputs: [{ name: 'query', label: 'Query', type: `query<${modelOf(node)}>` }],
        }),
        check(node, report) {
            const model = modelOf(node)
            const params = node.params ?? {}
            if (model === 'any') return report('from', `Choose what to search: ${SEARCH_MODELS.join(', ')}.`)
            const fields = SEARCH_FIELDS[model]
            if (valueNames(params.where).includes(PAGE.name))
                return report('where', 'A value in the filters cannot be called page: that is where the query’s page number goes.')
            if (params.where !== undefined && !checkWhere(params.where, { fields, model, placeholders: true }, (message) => report('where', message))) return
            if (params.orderBy !== undefined) checkOrderBy(params.orderBy, fields, model, (message) => report('orderBy', message))
        },
        // A wired page travels with the query: whoever runs it gives it that page's rows.
        run: (inputs, params) =>
            Object.fromEntries(
                Object.entries({
                    ...params,
                    where: params.where === undefined ? undefined : substitute(params.where, inputs),
                    page: typeof inputs.page === 'number' ? inputs.page : undefined,
                }).filter(([, value]) => value !== undefined),
            ),
        label: 'Build query',
        description: 'Describes a search: what to look for, how to filter and order it, and how many rows to take.',
        group: 'Queries',
        inputs: [PAGE],
        outputs: [{ name: 'query', label: 'Query', type: 'query<any>' }],
        params: [
            { name: 'from', label: 'Search', kind: 'model', required: true },
            { name: 'where', label: 'Filters', kind: 'where' },
            { name: 'orderBy', label: 'Order', kind: 'orderBy' },
            { name: 'take', label: 'Rows', kind: 'number', min: 1, max: 200 },
            { name: 'skip', label: 'Skip', kind: 'number', min: 0 },
            { name: 'feed', label: 'Apply feed rating preferences', kind: 'boolean' },
            { name: 'context', label: 'Mutes apply as in', kind: 'choice', options: ['feed', 'direct'] },
        ],
    },
    {
        id: 'query.run',
        ports(node, wired) {
            const query = wired('query')
            const model = query?.startsWith('query<') ? query.slice(6, -1) : 'any'
            return {
                inputs: [{ name: 'query', label: 'Query', type: 'query<any>' }],
                outputs: [{ name: 'rows', label: 'Rows', type: `list<${model}>` }],
            }
        },
        label: 'Run query',
        description: 'Runs a query as the reader and returns the rows they are allowed to see.',
        group: 'Queries',
        inputs: [{ name: 'query', label: 'Query', type: 'query<any>' }],
        outputs: [{ name: 'rows', label: 'Rows', type: 'list<any>' }],
        params: [],
        host: true,
    },
    {
        id: CALL,
        label: 'Run script',
        description: 'Runs another script and returns its outputs.',
        group: 'Scripts',
        inputs: [],
        outputs: [],
        params: [{ name: 'script', label: 'Script', kind: 'script', required: true }],
    },
    {
        id: 'filter',
        check(node, report) {
            checkWhere(node.params?.where, { placeholders: false }, (message) => report('where', message))
        },
        run: ({ list }, { where }) => (list as Row[]).filter((row) => matches(row, where)),
        label: 'Filter',
        description: 'Keeps the rows that match every condition.',
        group: 'Lists',
        inputs: [list()],
        outputs: [same()],
        params: [{ name: 'where', label: 'Conditions', kind: 'where', required: true }],
        dropsRows: true,
    },
    {
        id: 'sort',
        run: ({ list }, { by, direction }) => {
        const sign = direction === 'desc' ? -1 : 1
        return [...(list as Row[])].sort((a, b) => {
            const left = field(a, by)
            const right = field(b, by)
            const leftMissing = left === null || left === undefined
            const rightMissing = right === null || right === undefined
            // Rows without a value sort last in either direction.
            if (leftMissing || rightMissing) return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1
            return sign * (compare(left, right) ?? 0)
        })
    },
        label: 'Sort',
        description: 'Orders rows by one field.',
        group: 'Lists',
        inputs: [list()],
        outputs: [same()],
        params: [
            { name: 'by', label: 'Field', kind: 'field', required: true },
            { name: 'direction', label: 'Direction', kind: 'direction' },
        ],
    },
    {
        id: 'limit',
        run: ({ list }, { take, skip = 0 }) => (list as Row[]).slice(skip, skip + take),
        label: 'Limit',
        description: 'Keeps a window of rows: skip some, then take some.',
        group: 'Lists',
        inputs: [list()],
        outputs: [same()],
        params: [
            { name: 'take', label: 'Take', kind: 'number', required: true, min: 0, max: 2000 },
            { name: 'skip', label: 'Skip', kind: 'number', min: 0, max: 2000 },
        ],
        dropsRows: true,
    },
    {
        id: 'reverse',
        run: ({ list }) => [...(list as Row[])].reverse(),
        label: 'Reverse',
        description: 'Flips the order of the rows.',
        group: 'Lists',
        inputs: [list()],
        outputs: [same()],
        params: [],
    },
    {
        id: 'merge',
        run: ({ lists }) => (lists as Row[][]).flat(),
        label: 'Merge',
        description: 'Joins lists end to end, in the order they are wired.',
        group: 'Lists',
        inputs: [{ name: 'lists', label: 'Lists', type: 'list<any>', many: true }],
        outputs: [same('lists')],
        params: [],
    },
    {
        id: 'interleave',
        run: ({ a, b }, { every }) => {
        const out: Row[] = []
        let next = 0
        ;(a as Row[]).forEach((row, index) => {
            out.push(row)
            if ((index + 1) % every === 0 && next < (b as Row[]).length) out.push((b as Row[])[next++]!)
        })
        return out
    },
        label: 'Interleave',
        description: 'Inserts one row of the second list after every few rows of the first.',
        group: 'Lists',
        inputs: [list('a', 'Main rows'), list('b', 'Inserted rows')],
        outputs: [{ ...same(), like: ['a', 'b'] }],
        params: [{ name: 'every', label: 'After every', kind: 'number', required: true, min: 1, max: 2000 }],
    },
    {
        id: 'dedupe',
        run: ({ list }, { by = 'id' }) => {
        const seen = new Set<string>()
        return (list as Row[]).filter((row) => {
            const id = key(field(row, by))
            if (seen.has(id)) return false
            seen.add(id)
            return true
        })
    },
        label: 'Remove repeats',
        description: 'Keeps the first row for each value of a field.',
        group: 'Lists',
        inputs: [list()],
        outputs: [same()],
        params: [{ name: 'by', label: 'Field', kind: 'field' }],
        dropsRows: true,
    },
    {
        id: 'group',
        run: ({ list }, { by }) => {
        const groups = new Map<string, { key: unknown; items: Row[] }>()
        for (const row of list as Row[]) {
            const value = field(row, by) ?? null
            const id = key(value)
            if (!groups.has(id)) groups.set(id, { key: value, items: [] })
            groups.get(id)!.items.push(row)
        }
        return [...groups.values()]
    },
        label: 'Group',
        description: 'Collects rows that share a field value into groups with a key and items.',
        group: 'Lists',
        inputs: [list()],
        outputs: [{ name: 'groups', label: 'Groups', type: 'list<any>' }],
        params: [{ name: 'by', label: 'Field', kind: 'field', required: true }],
    },
    {
        id: 'first',
        run: ({ list }) => (list as Row[])[0] ?? null,
        label: 'First row',
        description: 'Takes the first row of a list.',
        group: 'Lists',
        inputs: [list()],
        outputs: [{ name: 'row', label: 'Row', type: 'row' }],
        params: [],
    },
    {
        id: 'count',
        run: ({ list }) => (list as Row[]).length,
        label: 'Count',
        description: 'Counts the rows in a list.',
        group: 'Lists',
        inputs: [list()],
        outputs: [{ name: 'count', label: 'Count', type: 'number' }],
        params: [],
    },
    {
        id: 'pluck',
        run: ({ list }, { field: name }) =>
        (list as Row[]).map((row) => field(row, name)).filter((value) => value !== undefined && value !== null),
        label: 'Pick a field',
        description: 'Takes one field from every row, for example ids to use in another query.',
        group: 'Lists',
        inputs: [list()],
        outputs: [{ name: 'values', label: 'Values', type: 'list<any>' }],
        params: [{ name: 'field', label: 'Field', kind: 'field', required: true }],
    },
    {
        id: 'text',
        run: (_, { value }) => value,
        label: 'Text',
        description: 'A fixed piece of text.',
        group: 'Values',
        inputs: [],
        outputs: [{ name: 'value', label: 'Text', type: 'text' }],
        params: [{ name: 'value', label: 'Text', kind: 'text', required: true }],
    },
    {
        id: 'number',
        run: (_, { value }) => value,
        label: 'Number',
        description: 'A fixed number.',
        group: 'Values',
        inputs: [],
        outputs: [{ name: 'value', label: 'Number', type: 'number' }],
        params: [{ name: 'value', label: 'Number', kind: 'number', required: true }],
    },
    {
        id: 'boolean',
        run: (_, { value }) => value,
        label: 'Yes or no',
        description: 'A fixed yes or no.',
        group: 'Values',
        inputs: [],
        outputs: [{ name: 'value', label: 'Value', type: 'boolean' }],
        params: [{ name: 'value', label: 'Value', kind: 'boolean', required: true }],
    },
]
