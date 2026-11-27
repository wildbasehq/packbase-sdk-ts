import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'

export type MigrationInputValue = string | number | boolean
export type MigrationInputs = Record<string, MigrationInputValue>
export type MigrationFieldType = 'text' | 'textarea' | 'password' | 'number' | 'boolean' | 'select'

export interface MigrationFieldDefinition {
    key: string
    label: string
    description: string
    type: MigrationFieldType
    required: boolean
    placeholder?: string
    min_length?: number
    max_length?: number
    pattern?: string
    min?: number
    max?: number
    options?: { value: string; label: string }[]
}

/** Server-owned inputs, availability, limits, and account restrictions. */
export interface MigrationServiceDefinition {
    id: string
    name: string
    description: string
    enabled: boolean
    unavailable_reason: string | null
    fields: MigrationFieldDefinition[]
    destination: { required: boolean; label: string }
    limits: { max_migrations_per_account: number | null; max_posts: number | null }
    soft_lock: { enabled: boolean; description: string }
    verification: { method: 'public_post'; instructions: string; expires_in_seconds: number }
    imports: string[]
    excludes: string[]
}

export interface MigrationServicesResponse {
    version: 1
    services: MigrationServiceDefinition[]
}

export type MigrationStatus = 'pending' | 'verified' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface MigrationRecord {
    id: string
    service: string
    status: MigrationStatus
    /** Policy captured when this migration was created; use it for review and progress. */
    policy: MigrationServiceDefinition
    /** Non-secret inputs only; password fields are never returned. */
    inputs: MigrationInputs
    tenant_id: string
    external_handle: string
    secret: string | null
    secret_expires: string | null
    progress_current: number
    progress_total: number
    error: string | null
    can_retry: boolean
    can_cancel: boolean
    soft_locked: boolean
    created_at: string
    completed_at: string | null
}

export interface MigrationStatusResponse {
    migrations: MigrationRecord[]
    account_locked: boolean
}

export interface CreateMigrationInput {
    service: string
    inputs: MigrationInputs
    tenant_id?: string
}

export type MigrationCreateInput = CreateMigrationInput
export type MigrationField = MigrationFieldDefinition

export interface MigrationsResource {
    /** Public schema. Always fetches fresh policy; rejects unsupported schemas. */
    services(options?: RequestOptions): Promise<MigrationServicesResponse>
    /** Creates an ownership challenge without starting an import. */
    create(input: CreateMigrationInput, options?: RequestOptions): Promise<MigrationRecord>
    /** Checks the public ownership proof. */
    verify(migrationId: string, options?: RequestOptions): Promise<MigrationRecord>
    /** Starts a verified import. */
    start(migrationId: string, options?: RequestOptions): Promise<MigrationRecord>
    /** Cancels when the record's can_cancel flag permits it. */
    cancel(migrationId: string, options?: RequestOptions): Promise<MigrationRecord>
    /** Retries when the record's can_retry flag permits it. */
    retry(migrationId: string, options?: RequestOptions): Promise<MigrationRecord>
    /** Fresh account migration history and authoritative account lock state. */
    status(options?: RequestOptions): Promise<MigrationStatusResponse>
}

type ObjectValue = Record<string, unknown>
function object(value: unknown): value is ObjectValue {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function string(value: unknown): value is string { return typeof value === 'string' }
function boolean(value: unknown): value is boolean { return typeof value === 'boolean' }
function nullableString(value: unknown): boolean { return value === null || string(value) }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function integer(value: unknown): value is number { return finite(value) && Number.isSafeInteger(value) && value >= 0 }
function date(value: unknown): boolean { return string(value) && Number.isFinite(Date.parse(value)) }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(string) }
function optional(value: unknown, check: (value: unknown) => boolean): boolean { return value === undefined || check(value) }
function inputs(value: unknown): value is MigrationInputs {
    return object(value) && Object.values(value).every(value => string(value) || boolean(value) || finite(value))
}
function unique(values: string[]): boolean { return new Set(values).size === values.length }
function field(value: unknown): value is MigrationFieldDefinition {
    if (!object(value) || !string(value.key) || !value.key || !string(value.label) ||
        !string(value.description) || !boolean(value.required) ||
        !['text', 'textarea', 'password', 'number', 'boolean', 'select'].includes(String(value.type)) ||
        !optional(value.placeholder, string) || !optional(value.min_length, integer) ||
        !optional(value.max_length, integer) || !optional(value.pattern, string) ||
        !optional(value.min, finite) || !optional(value.max, finite)) return false
    if (finite(value.min) && finite(value.max) && value.min > value.max) return false
    if (integer(value.min_length) && integer(value.max_length) && value.min_length > value.max_length) return false
    if (string(value.pattern)) { try { new RegExp(value.pattern) } catch { return false } }
    if (value.options !== undefined && (!Array.isArray(value.options) || !value.options.every(option =>
        object(option) && string(option.value) && string(option.label)))) return false
    if (Array.isArray(value.options) && !unique(value.options.map(option => option.value))) return false
    return value.type !== 'select' || (Array.isArray(value.options) && value.options.length > 0)
}
function service(value: unknown): value is MigrationServiceDefinition {
    if (!object(value) || !string(value.id) || !value.id || !string(value.name) ||
        !string(value.description) || !boolean(value.enabled) || !nullableString(value.unavailable_reason) ||
        !Array.isArray(value.fields) || !value.fields.every(field) || !unique(value.fields.map(field => field.key))) return false
    const { destination, limits, soft_lock, verification } = value
    return object(destination) && boolean(destination.required) && string(destination.label) &&
        object(limits) && (limits.max_migrations_per_account === null || integer(limits.max_migrations_per_account)) &&
        (limits.max_posts === null || integer(limits.max_posts)) &&
        object(soft_lock) && boolean(soft_lock.enabled) && string(soft_lock.description) &&
        object(verification) && verification.method === 'public_post' && string(verification.instructions) &&
        integer(verification.expires_in_seconds) && verification.expires_in_seconds > 0 &&
        strings(value.imports) && strings(value.excludes)
}
function record(value: unknown): value is MigrationRecord {
    return object(value) && string(value.id) && !!value.id && string(value.service) && !!value.service &&
        ['pending', 'verified', 'in_progress', 'completed', 'failed', 'cancelled'].includes(String(value.status)) &&
        service(value.policy) && inputs(value.inputs) && string(value.tenant_id) && string(value.external_handle) &&
        nullableString(value.secret) && (value.secret_expires === null || date(value.secret_expires)) &&
        integer(value.progress_current) && integer(value.progress_total) && nullableString(value.error) &&
        boolean(value.can_retry) && boolean(value.can_cancel) && boolean(value.soft_locked) &&
        date(value.created_at) && (value.completed_at === null || date(value.completed_at))
}
function requireRecord(value: unknown): MigrationRecord {
    if (!record(value)) throw new TypeError('Invalid migration response')
    return value
}

export function makeMigrations(http: HttpClient): MigrationsResource {
    const action = async (name: string, migrationId: string, options?: RequestOptions) =>
        requireRecord(await http.post<unknown>(`/migrate/${name}`, { migration_id: migrationId }, undefined, options))
    return {
        services: async options => {
            const value = await http.getFresh<unknown>('/migrate/services.json', options)
            if (!object(value) || value.version !== 1 || !Array.isArray(value.services) ||
                !value.services.every(service) || !unique(value.services.map(service => service.id))) {
                throw new TypeError('Invalid or unsupported migration services schema')
            }
            return value as unknown as MigrationServicesResponse
        },
        create: async (input, options) => requireRecord(await http.post<unknown>('/migrate/create', input, undefined, options)),
        verify: (id, options) => action('verify', id, options),
        start: (id, options) => action('start', id, options),
        cancel: (id, options) => action('cancel', id, options),
        retry: (id, options) => action('retry', id, options),
        status: async options => {
            const value = await http.getFresh<unknown>('/migrate/status', options)
            if (!object(value) || !Array.isArray(value.migrations) || !value.migrations.every(record) ||
                !boolean(value.account_locked)) throw new TypeError('Invalid migration status response')
            return value as unknown as MigrationStatusResponse
        },
    }
}
