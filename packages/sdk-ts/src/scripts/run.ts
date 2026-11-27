import { CALL, scriptInputs, splitRef, validateProgram, wires } from './validate'
import type { Program, ScriptFile, ScriptKind, ScriptNode, ScriptProblem } from './types'

/** A tool the host supplies, such as running a query. A rejection is reported against the node. */
export type HostTool = (
    inputs: Record<string, unknown>,
    params: Record<string, unknown>,
    at: { script: string; node: string },
) => Promise<unknown>

export interface RunOptions {
    kind: ScriptKind
    /** The entry script to run; the kind's first required entry when omitted. */
    entry?: string
    /** Values for the entry script's inputs. */
    inputs: Record<string, unknown>
    /** Entry outputs to compute; all of them when omitted. Nothing else runs. */
    outputs?: string[]
    host: Record<string, HostTool>
    /**
     * Called once for every node that runs, with its value or the problem that stopped it.
     * For a call node, once per output that is read. For debugging: it never changes a run.
     */
    trace?(at: TraceAt, result: TraceResult): void
    /**
     * A script whose every node also runs, in each instance the run creates, after the
     * requested outputs. Their failures are traced and never fail the run.
     */
    probe?: string
}

/** Where a traced node is. */
export interface TraceAt {
    script: string
    node: string
    /** Set for a call node: the output that was read. */
    output?: string
    /** The call nodes that led here, outermost first, as `<script>.<node>`. Empty in the entry script. */
    via: readonly string[]
}

export type TraceResult = { value: unknown } | { problem: ScriptProblem }

class Failure extends Error {
    constructor(readonly problem: ScriptProblem) {
        super(problem.message)
    }
}

/**
 * Runs a program's entry script and returns the requested outputs. Evaluation is pull-based:
 * only nodes the outputs depend on run, each once. Never throws; a failure is a problem
 * naming the script and node.
 */
export async function runProgram(
    program: Program,
    options: RunOptions,
): Promise<{ outputs: Record<string, unknown> } | { problem: ScriptProblem }> {
    const { kind, host } = options
    const start = options.entry ?? kind.required[0] ?? Object.keys(kind.entries)[0] ?? 'boot'
    const [invalid] = validateProgram(program, kind)
    if (invalid) return { problem: invalid }
    const tools = new Map(kind.tools.map((tool) => [tool.id, tool]))
    let steps = 0
    const spend = (amount: number, script: string, node: string) => {
        steps += amount
        if (steps > kind.limits.steps)
            throw new Failure({ script, node, path: `nodes.${node}`, message: 'This program does too much work for one run.' })
    }

    const probed: { file: ScriptFile; get: (ref: string) => Promise<unknown> }[] = []
    /** Reports a node to the tracer. A failure is reported where it happened, not downstream. */
    const traced = (at: TraceAt, running: Promise<unknown>) => {
        const report = (result: TraceResult) => {
            try {
                options.trace?.(at, result)
            } catch {
                /* A tracer never changes a run. */
            }
        }
        if (options.trace)
            running.then(
                (value) => report({ value }),
                (error) => {
                    if (error instanceof Failure && error.problem.script === at.script && error.problem.node === at.node)
                        report({ problem: error.problem })
                },
            )
        return running
    }

    /** Evaluates one script instance; each call node gets its own instance of the callee. */
    const instance = (script: string, inputs: Record<string, unknown>, via: readonly string[]) => {
        const file = program[script]!
        const cache = new Map<string, Promise<unknown>>()
        const children = new Map<string, Promise<(ref: string) => Promise<unknown>>>()
        const get = (ref: string): Promise<unknown> => {
            const { node: id, output } = splitRef(ref)
            if (id === 'input') return Promise.resolve(output === undefined ? undefined : inputs[output])
            const node = file.nodes[id]!
            if (node.tool === CALL) {
                if (!cache.has(ref))
                    cache.set(
                        ref,
                        traced(
                            { script, node: id, output: output!, via },
                            child(id, node).then((read) => read(output!)),
                        ),
                    )
                return cache.get(ref)!
            }
            if (!cache.has(id)) cache.set(id, traced({ script, node: id, via }, evaluate(id, node)))
            return cache.get(id)!
        }
        const gather = async (id: string, node: ScriptNode) => {
            const tool = tools.get(node.tool)!
            // Declared ports, plus any the node's settings add (a call's inputs, a query's values).
            const names = [...new Set([...tool.inputs.map((port) => port.name), ...Object.keys(node.in ?? {})])]
            const values: Record<string, unknown> = {}
            for (const name of names) {
                const found = await Promise.all(wires(node, name).map(get))
                const many = tool.inputs.find((port) => port.name === name)?.many
                values[name] = many ? found : found[0]
                const port = tool.inputs.find((entry) => entry.name === name)
                if (port?.type.startsWith('list<'))
                    for (const list of found) {
                        if (!Array.isArray(list))
                            throw new Failure({
                                script,
                                node: id,
                                path: `nodes.${id}.in.${name}`,
                                message: `${tool.label} expected rows for ${port.label}, but got something else.`,
                            })
                        if (list.length > kind.limits.rows)
                            throw new Failure({
                                script,
                                node: id,
                                path: `nodes.${id}.in.${name}`,
                                message: `${tool.label} can take at most ${kind.limits.rows.toLocaleString('en-US')} rows.`,
                            })
                        spend(list.length, script, id)
                    }
            }
            return values
        }
        const child = (id: string, node: ScriptNode) => {
            if (!children.has(id))
                children.set(
                    id,
                    gather(id, node).then((values) => {
                        spend(1, script, id)
                        const name = node.params!.script as string
                        const declared = Object.keys(scriptInputs(program, kind, name))
                        const callee = instance(name, Object.fromEntries(declared.map((input) => [input, values[input]])), [...via, `${script}.${id}`])
                        return (output: string) => callee(program[name]!.outputs[output]!)
                    }),
                )
            return children.get(id)!
        }
        const evaluate = async (id: string, node: ScriptNode) => {
            const tool = tools.get(node.tool)!
            const values = await gather(id, node)
            spend(1, script, id)
            const params = node.params ?? {}
            if (!tool.host) {
                if (!tool.run) throw new Failure({ script, node: id, path: `nodes.${id}`, message: `${tool.label} cannot run here.` })
                return tool.run(values, params)
            }
            const run = host[tool.id]
            const failed = (message: string) =>
                new Failure({ script, node: id, path: `nodes.${id}`, message })
            if (!run) throw failed(`${tool.label} is not available here.`)
            try {
                return await run(values, params, { script, node: id })
            } catch {
                // Host errors can carry internals; the host logs them, the author sees which node failed.
                throw failed(`${tool.label} failed.`)
            }
        }
        if (script === options.probe) probed.push({ file, get })
        return get
    }

    /** Runs what nothing read in the probed script. The list grows as probing reaches new instances. */
    const probe = async () => {
        for (let index = 0; index < probed.length; index++) {
            const { file, get } = probed[index]!
            const refs = Object.entries(file.nodes).flatMap(([id, node]) =>
                node.tool === CALL
                    ? Object.keys(program[node.params?.script as string]?.outputs ?? {}).map((output) => `${id}.${output}`)
                    : [id],
            )
            await Promise.allSettled(refs.map((ref) => get(ref)))
        }
    }

    try {
        const entry = program[start]
        if (!entry) return { problem: { script: start, path: '', message: `scripts/${start}.ruff does not exist.` } }
        const read = instance(start, options.inputs, [])
        const names = (options.outputs ?? Object.keys(entry.outputs)).filter((name) => Object.hasOwn(entry.outputs, name))
        const reading = names.map((name) => read(entry.outputs[name]!))
        let values: unknown[]
        if (options.probe === undefined) values = await Promise.all(reading)
        else {
            // A probed run finishes everything it can before reporting, so every node has a say.
            const settled = await Promise.allSettled(reading)
            await probe()
            values = settled.map((result) => {
                if (result.status === 'rejected') throw result.reason
                return result.value
            })
        }
        return { outputs: Object.fromEntries(names.map((name, index) => [name, values[index]])) }
    } catch (error) {
        if (error instanceof Failure) return { problem: error.problem }
        return { problem: { script: start, path: '', message: 'This program could not run.' } }
    }
}
