import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'

export type MaintenanceKind = 'bulk_delete' | 'factory_reset'
export type MaintenanceInput = { kind: 'bulk_delete'; tags: string[] } | { kind: 'factory_reset' }
export interface MaintenancePreview {
    token: string
    kind: MaintenanceKind
    tags: string[]
    own_count: number
    cascade_count: number
    total_count: number
    samples: { id: string; content: string | null; created_at: string }[]
    has_more: boolean
    server_time: string
    confirm_after: string
    expires_at: string
}
export interface MaintenanceOperation {
    id: string
    kind: MaintenanceKind
    status: 'queued' | 'running' | 'failed' | 'completed'
    phase: 'delete' | 'reset' | 'provider' | 'assets' | 'complete'
    own_count: number
    cascade_count: number
    total_count: number
    deleted_count: number
    cleanup_total: number
    cleanup_completed: number
    error: string | null
    can_retry: boolean
    created_at: string
    updated_at: string
    completed_at: string | null
    acknowledged_at: string | null
}
export interface MaintenanceCurrent {
    /** Latest confirmed factory reset, including acknowledged operations. */
    last_reset_id: string | null
    operation: MaintenanceOperation | null
    server_time: string
}
export interface MaintenanceResource {
    /** Prepares an immutable review. This does not delete anything. */
    preview(input: MaintenanceInput, options?: RequestOptions): Promise<MaintenancePreview>
    /** Confirms after the server-enforced wait. Reusing the token returns the same operation. */
    confirm(input: { token: string; username: string }, options?: RequestOptions): Promise<MaintenanceOperation>
    /** Fetches fresh unacknowledged operation state; never uses persistent HTTP caches. */
    current(options?: RequestOptions): Promise<MaintenanceCurrent>
    status(id: string, options?: RequestOptions): Promise<MaintenanceOperation>
    /** Resumes the same failed operation without selecting new content. */
    retry(id: string, options?: RequestOptions): Promise<MaintenanceOperation>
    acknowledge(id: string, options?: RequestOptions): Promise<MaintenanceOperation>
}

type Obj = Record<string, unknown>
const object = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value: unknown): value is string => typeof value === 'string'
const nonempty = (value: unknown): value is string => string(value) && value.trim().length > 0
const identifier = (value: unknown): value is string => nonempty(value) && value !== '.' && value !== '..'
const date = (value: unknown): value is string => string(value) && Number.isFinite(Date.parse(value))
const nullableDate = (value: unknown) => value === null || date(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const kind = (value: unknown): value is MaintenanceKind => value === 'bulk_delete' || value === 'factory_reset'
function counts(value: Obj) {
    return integer(value.own_count) && integer(value.cascade_count) && integer(value.total_count) &&
        value.total_count === value.own_count + value.cascade_count
}
function operation(value: unknown): value is MaintenanceOperation {
    return object(value) && nonempty(value.id) && kind(value.kind) &&
        string(value.status) && ['queued', 'running', 'failed', 'completed'].includes(value.status) &&
        string(value.phase) && ['delete', 'reset', 'provider', 'assets', 'complete'].includes(value.phase) && counts(value) &&
        integer(value.deleted_count) && value.deleted_count <= Number(value.total_count) &&
        integer(value.cleanup_total) && integer(value.cleanup_completed) && value.cleanup_completed <= value.cleanup_total &&
        (value.error === null || string(value.error)) && typeof value.can_retry === 'boolean' &&
        date(value.created_at) && date(value.updated_at) && nullableDate(value.completed_at) && nullableDate(value.acknowledged_at)
}
function requireOperation(value: unknown): MaintenanceOperation {
    if (!operation(value)) throw new TypeError('Invalid maintenance operation response')
    return value
}
function requirePreview(value: unknown): MaintenancePreview {
    if (!object(value) || !nonempty(value.token) || !kind(value.kind) || !counts(value) ||
        !Array.isArray(value.tags) || !value.tags.every(nonempty) ||
        (value.kind === 'bulk_delete' && value.tags.length === 0) || (value.kind === 'factory_reset' && value.tags.length !== 0) ||
        !Array.isArray(value.samples) || value.samples.length > 100 || value.samples.length > Number(value.own_count) || !value.samples.every(sample =>
            object(sample) && nonempty(sample.id) && (sample.content === null || string(sample.content)) && date(sample.created_at)) ||
        typeof value.has_more !== 'boolean' || !date(value.server_time) || !date(value.confirm_after) || !date(value.expires_at) ||
        Date.parse(value.confirm_after) >= Date.parse(value.expires_at)) {
        throw new TypeError('Invalid maintenance preview response')
    }
    return value as unknown as MaintenancePreview
}
export function makeMaintenance(http: HttpClient): MaintenanceResource {
    const base = '/user/me/maintenance'
    const action = async (id: string, name: string, options?: RequestOptions) => {
        if (!identifier(id)) throw new TypeError('Maintenance operation ID is required')
        return requireOperation(await http.post<unknown>(`${base}/${encodeURIComponent(id)}/${name}`, {}, undefined, options))
    }
    return {
        preview: async (input, options) => {
            if (!object(input) || !kind(input.kind) ||
                (input.kind === 'factory_reset' && 'tags' in input && (!Array.isArray(input.tags) || input.tags.length !== 0)) || (input.kind === 'bulk_delete' &&
                (!Array.isArray(input.tags) || input.tags.length === 0 || input.tags.some(tag => !string(tag) || !tag.trim())))) {
                throw new TypeError('Bulk deletion requires at least one non-empty tag')
            }
            return requirePreview(await http.post<unknown>(`${base}/preview`, input, undefined, options))
        },
        confirm: async (input, options) => {
            if (!object(input) || !nonempty(input.token) || !nonempty(input.username)) throw new TypeError('Confirmation token and username are required')
            return requireOperation(await http.post<unknown>(`${base}/confirm`, input, undefined, options))
        },
        current: async options => {
            const value = await http.getFresh<unknown>(`${base}/current`, options)
            if (!object(value) || !date(value.server_time) || (value.last_reset_id !== null && !nonempty(value.last_reset_id)) || (value.operation !== null && !operation(value.operation))) {
                throw new TypeError('Invalid current maintenance response')
            }
            return value as unknown as MaintenanceCurrent
        },
        status: async (id, options) => {
            if (!identifier(id)) throw new TypeError('Maintenance operation ID is required')
            return requireOperation(await http.getFresh<unknown>(`${base}/${encodeURIComponent(id)}`, options))
        },
        retry: (id, options) => action(id, 'retry', options),
        acknowledge: (id, options) => action(id, 'acknowledge', options),
    }
}
