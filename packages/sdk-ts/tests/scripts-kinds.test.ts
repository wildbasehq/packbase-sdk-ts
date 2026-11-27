import { describe, expect, test } from 'bun:test'
import {
    CALL, DEFAULT_SCRIPT_LIMITS, describeNode, runProgram, TOOLS, validateProgram,
    type HostTool, type Program, type ScriptKind, type ToolDefinition,
} from '../src/scripts'

/**
 * A kind that has nothing to do with feeds or search: scripts that answer a button press.
 * It brings its own tools, entry points and rules; the engine is used as it is.
 */
const tools: ToolDefinition[] = [
    TOOLS.find((tool) => tool.id === CALL)!,
    {
        id: 'greeting',
        label: 'Greeting',
        description: 'Makes a greeting for a name.',
        group: 'Text',
        inputs: [{ name: 'name', label: 'Name', type: 'text' }],
        outputs: [{ name: 'text', label: 'Text', type: 'text' }],
        params: [{ name: 'word', label: 'Word', kind: 'text', required: true }],
        check: (node, report) => {
            if (node.params?.word === 'bye') report('word', 'A greeting cannot say bye.')
        },
        run: ({ name }, { word }) => `${word}, ${name}!`,
    },
    {
        id: 'toast.show',
        label: 'Show message',
        description: 'Shows a message to the person who pressed.',
        group: 'Actions',
        inputs: [{ name: 'text', label: 'Text', type: 'text' }],
        outputs: [{ name: 'shown', label: 'Shown', type: 'boolean' }],
        params: [],
        host: true,
    },
    {
        id: 'pair',
        label: 'Pair',
        description: 'A node whose outputs depend on its settings.',
        group: 'Text',
        inputs: [],
        outputs: [],
        params: [{ name: 'names', label: 'Names', kind: 'names' }],
        ports: (node) => ({
            inputs: [],
            outputs: ((node.params?.names as string[]) ?? []).map((name) => ({ name, label: name, type: 'text' })),
        }),
        run: (_inputs, { names }) => names,
    },
]
const pressKind: ScriptKind = {
    id: 'press',
    entries: { on_press: { who: 'text' }, on_hold: { who: 'text', seconds: 'number' } },
    required: ['on_press'],
    tools,
    limits: DEFAULT_SCRIPT_LIMITS,
    check: (program) =>
        Object.keys(program).length > 2 ? [{ script: 'on_press', path: '', message: 'Keep it to two scripts.' }] : [],
}
const program: Program = {
    on_press: {
        version: 1,
        nodes: {
            hello: { tool: 'greeting', params: { word: 'Hello' }, in: { name: 'input.who' } },
            say: { tool: 'toast.show', in: { text: 'hello' } },
        },
        outputs: { done: 'say', text: 'hello' },
    },
}

describe('a kind that is not a feed', () => {
    test('validates with its own tools, entry points and rules', () => {
        expect(validateProgram(program, pressKind)).toEqual([])
        expect(validateProgram({}, pressKind)[0]).toMatchObject({ script: 'on_press' })
        const bye = structuredClone(program)
        bye.on_press!.nodes.hello!.params = { word: 'bye' }
        expect(validateProgram(bye, pressKind)[0]).toMatchObject({
            node: 'hello', path: 'nodes.hello.params.word', message: 'A greeting cannot say bye.',
        })
        const three = { ...program, a: { version: 1 as const, nodes: {}, outputs: {} }, b: { version: 1 as const, nodes: {}, outputs: {} } }
        expect(validateProgram(three, pressKind)[0]!.message).toBe('Keep it to two scripts.')
    })

    test('an optional entry point gets its own inputs', () => {
        const held: Program = {
            ...program,
            on_hold: { version: 1, nodes: {}, outputs: { seconds: 'input.seconds', who: 'input.who' } },
        }
        expect(validateProgram(held, pressKind)).toEqual([])
        // `seconds` belongs to on_hold only.
        const wrong = structuredClone(program)
        wrong.on_press!.outputs.seconds = 'input.seconds'
        expect(validateProgram(wrong, pressKind)[0]).toMatchObject({ path: 'outputs.seconds' })
    })

    test('runs an entry point with host actions and no search', async () => {
        const shown: unknown[] = []
        const show: HostTool = async ({ text }) => {
            shown.push(text)
            return true
        }
        expect(
            await runProgram(program, { kind: pressKind, inputs: { who: 'Rek' }, host: { 'toast.show': show } }),
        ).toEqual({ outputs: { done: true, text: 'Hello, Rek!' } })
        expect(shown).toEqual(['Hello, Rek!'])
        const held: Program = {
            ...program,
            on_hold: { version: 1, nodes: {}, outputs: { seconds: 'input.seconds' } },
        }
        expect(
            await runProgram(held, { kind: pressKind, entry: 'on_hold', inputs: { who: 'Rek', seconds: 2 }, host: {} }),
        ).toEqual({ outputs: { seconds: 2 } })
    })

    test('a tool can define ports from its own settings', () => {
        const paired: Program = {
            on_press: {
                version: 1,
                nodes: { p: { tool: 'pair', params: { names: ['left', 'right'] } } },
                outputs: { side: 'p.right' },
            },
        }
        expect(describeNode(paired, 'on_press', 'p', pressKind).outputs.map((port) => port.name)).toEqual(['left', 'right'])
        expect(validateProgram(paired, pressKind)).toEqual([])
        paired.on_press!.outputs.side = 'p.middle'
        expect(validateProgram(paired, pressKind)[0]).toMatchObject({ path: 'outputs.side' })
    })
})
