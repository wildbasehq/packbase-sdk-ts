import type { PortType, Program, ScriptFile, ScriptKind, ScriptNode, ScriptProblem, ToolDefinition, ToolParam, ToolPort } from './types'

/** Node ids, input names and output names. */
export const NODE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
/** A script's name: `scripts/<name>.ruff`. */
export const SCRIPT_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/
const PORT_TYPE = /^[a-z][a-z_]*(?:<[a-z][a-z_]*>)?$/

/** The tool that runs another script. Every kind that allows calls includes it. */
export const CALL = 'call'

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a value of type `from` may be wired into a port of type `to`. */
export function accepts(from: PortType, to: PortType): boolean {
    if (from === to || to === 'any' || from === 'any') return true
    const [fromShape] = from.split('<')
    const [toShape, toItem] = to.split('<')
    return fromShape === toShape && toItem === 'any>'
}

// ---------------------------------------------------------------------------
// File shape
// ---------------------------------------------------------------------------

function shapeProblems(value: unknown, script: string): ScriptProblem[] {
    const problem = (path: string, message: string, node?: string): ScriptProblem[] => [
        { script, ...(node ? { node } : {}), path, message },
    ]
    if (!isRecord(value)) return problem('', 'A script is a JSON object with version, nodes and outputs.')
    if (value.version !== 1) return problem('version', 'Set version to 1.')
    if (!isRecord(value.nodes)) return problem('nodes', 'nodes must be an object of nodes by id.')
    if (!isRecord(value.outputs)) return problem('outputs', 'outputs must be an object of names to wires.')
    if (value.inputs !== undefined && !isRecord(value.inputs))
        return problem('inputs', 'inputs must be an object of names to types.')
    for (const [name, type] of Object.entries(value.inputs ?? {}))
        if (typeof type !== 'string' || !PORT_TYPE.test(type))
            return problem(`inputs.${name}`, `Input ${name} has an unknown type.`)
    for (const [name, ref] of Object.entries(value.outputs))
        if (typeof ref !== 'string') return problem(`outputs.${name}`, `Output ${name} must be wired to a node.`)
    for (const [id, node] of Object.entries(value.nodes)) {
        const at = `nodes.${id}`
        if (!isRecord(node) || typeof node.tool !== 'string')
            return problem(at, `Node ${id} needs a tool.`, id)
        if (node.params !== undefined && !isRecord(node.params))
            return problem(`${at}.params`, 'params must be an object.', id)
        if (node.in !== undefined && !isRecord(node.in)) return problem(`${at}.in`, 'in must be an object.', id)
        for (const [port, wire] of Object.entries(node.in ?? {}))
            if (
                typeof wire !== 'string' &&
                !(Array.isArray(wire) && wire.every((entry) => typeof entry === 'string'))
            )
                return problem(`${at}.in.${port}`, `Input ${port} must be a wire or a list of wires.`, id)
        if (
            node.at !== undefined &&
            !(Array.isArray(node.at) && node.at.length === 2 && node.at.every((n) => typeof n === 'number' && Number.isFinite(n)))
        )
            return problem(`${at}.at`, 'at must be a pair of numbers.', id)
    }
    return []
}

/** Parses the text of a `.ruff` file. Never throws. */
export function parseScript(json: string, script: string): { file: ScriptFile } | { problem: ScriptProblem } {
    let value: unknown
    try {
        value = JSON.parse(json)
    } catch {
        return { problem: { script, path: '', message: 'This script is not valid JSON.' } }
    }
    const [problem] = shapeProblems(value, script)
    return problem ? { problem } : { file: value as ScriptFile }
}

// ---------------------------------------------------------------------------
// References and types
// ---------------------------------------------------------------------------

interface Context {
    program: Program
    kind: ScriptKind
    tools: Map<string, ToolDefinition>
    types: Map<string, PortType | undefined>
    visiting: Set<string>
}

function context(program: Program, kind: ScriptKind): Context {
    return {
        program,
        kind,
        tools: new Map(kind.tools.map((tool) => [tool.id, tool])),
        types: new Map(),
        visiting: new Set(),
    }
}

/** What a script receives: what the host passes an entry script, or what a called one declares. */
export function scriptInputs(program: Program, kind: ScriptKind, script: string): Record<string, PortType> {
    return Object.hasOwn(kind.entries, script) ? kind.entries[script]! : (program[script]?.inputs ?? {})
}

/** Splits a wire into its node (or `input`) and optional output name. */
export function splitRef(ref: string): { node: string; output?: string } {
    const dot = ref.indexOf('.')
    return dot < 0 ? { node: ref } : { node: ref.slice(0, dot), output: ref.slice(dot + 1) }
}

export function wires(node: ScriptNode, port: string): string[] {
    const wire = node.in?.[port]
    return wire === undefined ? [] : Array.isArray(wire) ? wire : [wire]
}

function ports(ctx: Context, script: string, id: string): { inputs: ToolPort[]; outputs: ToolPort[] } {
    const node = ctx.program[script]?.nodes[id]
    const tool = node && ctx.tools.get(node.tool)
    if (!node || !tool) return { inputs: [], outputs: [] }
    if (tool.id === CALL) {
        const name = node.params?.script
        const callee = typeof name === 'string' ? ctx.program[name] : undefined
        if (!callee || typeof name !== 'string') return { inputs: [], outputs: [] }
        return {
            inputs: Object.entries(scriptInputs(ctx.program, ctx.kind, name)).map(([port, type]) => ({
                name: port,
                label: port,
                type,
            })),
            outputs: Object.entries(callee.outputs).map(([port, ref]) => ({
                name: port,
                label: port,
                type: typeOf(ctx, name, ref) ?? 'any',
            })),
        }
    }
    /** The one type wired into a port, when everything wired into it agrees. */
    const wired = (port: string): PortType | undefined => {
        const found = wires(node, port).map((ref) => typeOf(ctx, script, ref))
        return found.length && found.every((type) => type === found[0]) ? found[0] : undefined
    }
    if (tool.ports) return tool.ports(node, wired)
    return {
        inputs: [...tool.inputs],
        outputs: tool.outputs.map((port) => {
            if (!port.like) return port
            const found = (typeof port.like === 'string' ? [port.like] : port.like).map(wired)
            const type = found.every((entry) => entry && entry === found[0]) ? found[0]! : port.type
            return { name: port.name, label: port.label, type }
        }),
    }
}

/** The type a wire carries, or undefined when it cannot be resolved. */
function typeOf(ctx: Context, script: string, ref: string): PortType | undefined {
    const key = `${script}\u0000${ref}`
    if (ctx.types.has(key)) return ctx.types.get(key)
    if (ctx.visiting.has(key)) return undefined
    ctx.visiting.add(key)
    const { node, output } = splitRef(ref)
    let type: PortType | undefined
    if (node === 'input') type = output === undefined ? undefined : scriptInputs(ctx.program, ctx.kind, script)[output]
    else {
        const outputs = ports(ctx, script, node).outputs
        const isCall = ctx.program[script]?.nodes[node]?.tool === CALL
        type = (output === undefined ? (isCall ? undefined : outputs[0]) : outputs.find((port) => port.name === output))
            ?.type
    }
    ctx.visiting.delete(key)
    ctx.types.set(key, type)
    return type
}

/** A node's ports with their types resolved: a call node's come from the script it calls. */
export function describeNode(
    program: Program,
    script: string,
    node: string,
    kind: ScriptKind,
): { inputs: ToolPort[]; outputs: ToolPort[] } {
    return ports(context(program, kind), script, node)
}

/** The type a wire carries inside a script, or undefined when it does not resolve. */
export function wireType(program: Program, script: string, ref: string, kind: ScriptKind): PortType | undefined {
    return typeOf(context(program, kind), script, ref)
}

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

/**
 * Every node a run of an entry script reaches for the given outputs (all of them by default),
 * once per time it runs: a script called twice counts its nodes twice.
 */
export function reachableNodes(
    program: Program,
    entry: string,
    outputs?: string[],
): { script: string; node: string; tool: string; params: Record<string, unknown> }[] {
    const found: { script: string; node: string; tool: string; params: Record<string, unknown> }[] = []
    const walk = (script: string, wanted: string[] | undefined, depth: number) => {
        const file = program[script]
        if (!file || depth > 32) return
        const needed = new Set<string>()
        const callOutputs = new Map<string, Set<string>>()
        const queue = (wanted ?? Object.keys(file.outputs)).flatMap((name) => file.outputs[name] ?? [])
        while (queue.length) {
            const { node: id, output } = splitRef(queue.pop()!)
            const node = file.nodes[id]
            if (id === 'input' || !node) continue
            if (node.tool === CALL && output !== undefined) {
                if (!callOutputs.has(id)) callOutputs.set(id, new Set())
                callOutputs.get(id)!.add(output)
            }
            if (needed.has(id)) continue
            needed.add(id)
            for (const wire of Object.values(node.in ?? {})) queue.push(...(Array.isArray(wire) ? wire : [wire]))
        }
        for (const id of needed) {
            const node = file.nodes[id]!
            if (node.tool === CALL) {
                if (typeof node.params?.script === 'string')
                    walk(node.params.script, [...(callOutputs.get(id) ?? [])], depth + 1)
            } else found.push({ script, node: id, tool: node.tool, params: node.params ?? {} })
        }
    }
    walk(entry, outputs, 0)
    return found
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type Report = (path: string, message: string) => void

/** Checks the parameter kinds every tool shares; anything else is the tool's own to check. */
function checkParam(param: ToolParam, value: unknown, program: Program, script: string, path: string, report: Report) {
    switch (param.kind) {
        case 'field':
            if (typeof value !== 'string' || !value) report(path, `${param.label} must name a field.`)
            return
        case 'direction':
            if (value !== 'asc' && value !== 'desc') report(path, `${param.label} must be "asc" or "desc".`)
            return
        case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value)) report(path, `${param.label} must be a number.`)
            else if (param.min !== undefined && (value < param.min || !Number.isInteger(value)))
                report(path, `${param.label} must be a whole number of at least ${param.min}.`)
            else if (param.max !== undefined && value > param.max)
                report(path, `${param.label} can be at most ${param.max}.`)
            return
        case 'text':
            if (typeof value !== 'string') report(path, `${param.label} must be text.`)
            else if (value.length > 2000) report(path, `${param.label} can be at most 2,000 characters.`)
            return
        case 'boolean':
            if (typeof value !== 'boolean') report(path, `${param.label} must be true or false.`)
            return
        case 'choice':
            if (!param.options?.includes(value as string))
                report(path, `${param.label} must be one of ${param.options?.join(', ')}.`)
            return
        case 'script':
            if (typeof value !== 'string' || !SCRIPT_NAME.test(value)) report(path, 'Choose a script to run.')
            else if (!Object.hasOwn(program, value)) report(path, `scripts/${value}.ruff does not exist.`)
            else if (value === script) report(path, `scripts/${value}.ruff calls itself through this node.`)
            return
    }
}

function validateScript(ctx: Context, script: string, problems: ScriptProblem[]) {
    const file = ctx.program[script]!
    const { limits } = ctx.kind
    const top = (path: string, message: string) => problems.push({ script, path, message })
    const ids = Object.keys(file.nodes)
    if (ids.length > limits.nodes) top('nodes', `A script can have at most ${limits.nodes} nodes; this one has ${ids.length}.`)
    if (Object.keys(file.outputs).length > limits.outputs)
        top('outputs', `A script can have at most ${limits.outputs} outputs.`)
    if (Object.hasOwn(ctx.kind.entries, script) && Object.keys(file.inputs ?? {}).length)
        top('inputs', `scripts/${script}.ruff is run directly, so it cannot declare inputs.`)
    for (const name of Object.keys(file.inputs ?? {}))
        if (!NODE_NAME.test(name)) top(`inputs.${name}`, 'Input names start with a letter and use letters, digits or underscores.')

    const exists = (ref: string) => {
        const { node, output } = splitRef(ref)
        if (node === 'input') return output !== undefined && Object.hasOwn(scriptInputs(ctx.program, ctx.kind, script), output)
        const target = file.nodes[node]
        if (!target || !NODE_NAME.test(node)) return false
        // An unknown tool or a broken call is reported on that node, not on every consumer.
        const tool = ctx.tools.get(target.tool)
        if (!tool) return true
        const outputs = ports(ctx, script, node).outputs
        if (tool.id === CALL) return !outputs.length || outputs.some((port) => port.name === output)
        return output === undefined || outputs.some((port) => port.name === output)
    }

    const cyclic = cycleNodes(file)
    for (const id of ids) {
        const node = file.nodes[id]!
        const at = `nodes.${id}`
        const report: Report = (path, message) => problems.push({ script, node: id, path, message })
        if (!NODE_NAME.test(id) || id === 'input') {
            report(at, 'Node ids start with a letter and use letters, digits or underscores.')
            continue
        }
        const tool = ctx.tools.get(node.tool)
        if (!tool) {
            report(`${at}.tool`, `Unknown tool ${JSON.stringify(node.tool)}.`)
            continue
        }
        if (cyclic.has(id)) {
            report(at, 'This node is wired in a loop. Scripts run once from left to right.')
            continue
        }
        let paramsOk = true
        const reportParam: Report = (path, message) => {
            // One problem per node's settings is enough to act on.
            if (paramsOk) report(path, message)
            paramsOk = false
        }
        for (const key of Object.keys(node.params ?? {}))
            if (!tool.params.some((param) => param.name === key) && node.params![key] !== undefined)
                reportParam(`${at}.params.${key}`, `${tool.label} has no setting named ${key}.`)
        for (const param of tool.params) {
            const value = node.params?.[param.name]
            if (value === undefined) {
                if (param.required) reportParam(`${at}.params.${param.name}`, `${tool.label} needs ${param.label.toLowerCase()}.`)
                continue
            }
            checkParam(param, value, ctx.program, script, `${at}.params.${param.name}`, reportParam)
        }
        if (paramsOk) tool.check?.(node, (param, message) => reportParam(`${at}.params.${param}`, message))
        if (!paramsOk) continue
        const { inputs } = ports(ctx, script, id)
        for (const port of Object.keys(node.in ?? {}))
            if (!inputs.some((input) => input.name === port))
                report(`${at}.in.${port}`, `${tool.label} has no input named ${port}.`)
        for (const port of inputs) {
            const refs = wires(node, port.name)
            const path = `${at}.in.${port.name}`
            if (!refs.length) {
                report(path, `Wire something into ${port.label}.`)
                continue
            }
            if (refs.length > 1 && !port.many) {
                report(path, `${port.label} takes one wire.`)
                continue
            }
            for (const ref of refs) {
                if (!exists(ref)) {
                    report(path, `${port.label} is wired to ${ref}, which does not exist.`)
                    continue
                }
                const type = typeOf(ctx, script, ref)
                if (type && !accepts(type, port.type))
                    report(path, `${port.label} expects ${port.type}, but ${ref} gives ${type}.`)
            }
        }
    }
    for (const [name, ref] of Object.entries(file.outputs)) {
        const path = `outputs.${name}`
        if (!NODE_NAME.test(name)) top(path, 'Output names start with a letter and use letters, digits or underscores.')
        else if (!exists(ref)) top(path, `Output ${name} is wired to ${ref}, which does not exist.`)
    }
}

/** Ids of nodes that sit on a wiring loop. */
function cycleNodes(file: ScriptFile): Set<string> {
    const state = new Map<string, 'open' | 'done'>()
    const cyclic = new Set<string>()
    const stack: string[] = []
    const visit = (id: string) => {
        if (state.get(id) === 'done') return
        if (state.get(id) === 'open') {
            for (const entry of stack.slice(stack.indexOf(id))) cyclic.add(entry)
            return
        }
        state.set(id, 'open')
        stack.push(id)
        for (const wire of Object.values(file.nodes[id]?.in ?? {}))
            for (const ref of Array.isArray(wire) ? wire : [wire]) {
                const target = splitRef(ref).node
                if (target !== 'input' && file.nodes[target]) visit(target)
            }
        stack.pop()
        state.set(id, 'done')
    }
    for (const id of Object.keys(file.nodes)) visit(id)
    return cyclic
}

/** Reports call chains that loop back or run too deep. Returns false when the call graph loops. */
function validateCalls(program: Program, kind: ScriptKind, problems: ScriptProblem[]): boolean {
    let acyclic = true
    const reported = new Set<string>()
    const visit = (script: string, chain: string[]) => {
        const file = program[script]
        if (!file) return
        if (chain.length > kind.limits.depth) {
            if (!reported.has('depth'))
                problems.push({
                    script: chain[0]!,
                    path: 'nodes',
                    message: `Scripts can call each other at most ${kind.limits.depth} levels deep.`,
                })
            reported.add('depth')
            return
        }
        for (const [id, node] of Object.entries(file.nodes)) {
            const target = node.tool === CALL ? node.params?.script : undefined
            if (typeof target !== 'string' || !program[target] || target === script) continue
            if (chain.includes(target)) {
                acyclic = false
                const key = `${script}\u0000${id}`
                if (!reported.has(key))
                    problems.push({
                        script,
                        node: id,
                        path: `nodes.${id}.params.script`,
                        message: `scripts/${target}.ruff calls itself through this node.`,
                    })
                reported.add(key)
                continue
            }
            visit(target, [...chain, target])
        }
    }
    for (const script of Object.keys(program)) visit(script, [script])
    return acyclic
}

/** Every problem that would stop a program from running. Never throws, whatever it is given. */
export function validateProgram(program: Record<string, unknown>, kind: ScriptKind): ScriptProblem[] {
    const problems: ScriptProblem[] = []
    const first = kind.required[0] ?? Object.keys(kind.entries)[0] ?? 'boot'
    if (!isRecord(program)) return [{ script: first, path: '', message: 'Expected scripts by name.' }]
    const valid: Program = {}
    for (const [name, file] of Object.entries(program)) {
        if (!SCRIPT_NAME.test(name)) {
            problems.push({
                script: name,
                path: '',
                message: 'Script names start with a letter and use letters, digits, hyphens or underscores.',
            })
            continue
        }
        const shape = shapeProblems(file, name)
        if (shape.length) problems.push(...shape)
        else valid[name] = file as ScriptFile
    }
    for (const entry of kind.required)
        if (!Object.hasOwn(program, entry))
            problems.push({ script: entry, path: '', message: `scripts/${entry}.ruff is required: it runs first.` })
    if (Object.keys(program).length > kind.limits.scripts)
        problems.push({
            script: first,
            path: '',
            message: `A repository can have at most ${kind.limits.scripts} scripts.`,
        })
    // Calls resolve against every script, so a call to a script with a broken shape is not "missing".
    const known: Program = { ...valid }
    for (const name of Object.keys(program)) if (!known[name] && SCRIPT_NAME.test(name)) known[name] = { version: 1, nodes: {}, outputs: {} }
    const ctx = context(known, kind)
    for (const name of Object.keys(valid)) validateScript(ctx, name, problems)
    const acyclic = validateCalls(valid, kind, problems)
    if (problems.length || !acyclic) return problems
    return kind.check?.(valid) ?? []
}
