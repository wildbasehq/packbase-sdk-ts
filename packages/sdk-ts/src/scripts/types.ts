/**
 * What a port carries. Scalars are plain words (`text`, `number`, `boolean`, `row`, `any`);
 * collections name what they hold, such as `list<posts>`. `<any>` accepts every item type,
 * and `any` accepts everything. Kinds are free to introduce their own.
 */
export type PortType = string

/** How an editor should draw a parameter. Kinds an editor does not know fall back to raw JSON. */
export type ParamKind = string

export interface ToolParam {
    name: string
    label: string
    kind: ParamKind
    required?: boolean
    min?: number
    max?: number
    /** The values a `choice` accepts. */
    options?: readonly string[]
}

/**
 * `many`: accepts a list of wires. `optional`: may be left unwired. `like`: an output that takes the type of the named input,
 * or of several inputs when they all carry the same type.
 */
export interface ToolPort {
    name: string
    label: string
    type: PortType
    many?: boolean
    optional?: boolean
    like?: string | readonly string[]
}

/** One node. `at` is its canvas position and never changes what the script does. */
export interface ScriptNode {
    tool: string
    params?: Record<string, unknown>
    /** Input port to a node id, `<node>.<output>`, or `input.<name>`. */
    in?: Record<string, string | string[]>
    at?: [number, number]
}

/**
 * A tool is everything the engine and an editor need to know about a node: how to draw it,
 * what its ports are, how to check its settings, and what it computes. A new kind of script
 * is a list of these; the engine has no knowledge of any particular tool.
 */
export interface ToolDefinition {
    id: string
    label: string
    description: string
    group: string
    inputs: readonly ToolPort[]
    outputs: readonly ToolPort[]
    params: readonly ToolParam[]
    /** Ports that depend on the node's settings or on what is wired into it. */
    ports?(
        node: ScriptNode,
        wired: (port: string) => PortType | undefined,
    ): { inputs: ToolPort[]; outputs: ToolPort[] }
    /** Checks only this tool can make of its settings. `param` names the setting at fault. */
    check?(node: ScriptNode, report: (param: string, message: string) => void): void
    /** What the tool computes from its inputs and settings. Absent on host tools. */
    run?(inputs: Record<string, any>, params: Record<string, any>): unknown
    /** Runs through a function the host supplies, such as a search or a user action. */
    host?: boolean
    /** Can return fewer rows than it was given. */
    dropsRows?: boolean
}

/** The contents of a `scripts/<name>.ruff` file. */
export interface ScriptFile {
    version: 1
    inputs?: Record<string, PortType>
    nodes: Record<string, ScriptNode>
    outputs: Record<string, string>
}

/** Every script of a repository by name; `scripts/boot.ruff` is `boot`. */
export type Program = Record<string, ScriptFile>

export interface ScriptLimits {
    scripts: number
    nodes: number
    depth: number
    outputs: number
    rows: number
    steps: number
}

export interface ScriptProblem {
    script: string
    node?: string
    /** JSON path inside the script file, such as `nodes.build.params.where`. */
    path: string
    message: string
}

/**
 * A kind of script: where it can be entered, which tools it may use, and its own rules.
 * Feeds and themes are kinds; so would be scripts that answer a button press.
 */
export interface ScriptKind {
    id: string
    /**
     * Scripts a host can run directly, with the inputs it passes to each as `input.<name>`.
     * An entry script declares no inputs of its own.
     */
    entries: Record<string, Record<string, PortType>>
    /** Entry scripts every program of this kind must have. */
    required: readonly string[]
    tools: readonly ToolDefinition[]
    limits: ScriptLimits
    /** Rules beyond wiring and types, checked once a program is otherwise valid. */
    check?(program: Program): ScriptProblem[]
}
