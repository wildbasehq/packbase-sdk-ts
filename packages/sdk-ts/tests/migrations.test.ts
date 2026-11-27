import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type MigrationRecord, type MigrationServicesResponse } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const sdk = () => new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })
const schema: MigrationServicesResponse = {
    version: 1,
    services: [{
        id: 'bluesky', name: 'Bluesky', description: 'Import your posts.', enabled: true,
        unavailable_reason: null,
        fields: [{ key: 'handle', label: 'Handle', description: 'Public handle', type: 'text', required: true }],
        destination: { required: true, label: 'Destination pack' },
        limits: { max_migrations_per_account: 1, max_posts: 10000 },
        soft_lock: { enabled: true, description: 'Writes pause during import.' },
        verification: { method: 'public_post', instructions: 'Publish the proof.', expires_in_seconds: 86400 },
        imports: ['Posts'], excludes: ['Messages'],
    }],
}

const migration: MigrationRecord = {
    policy: schema.services[0]!,
    id: 'migration-id', service: 'bluesky', status: 'pending', inputs: { handle: 'example.bsky.social' },
    tenant_id: 'pack-id', external_handle: 'example.bsky.social', secret: 'proof',
    secret_expires: '2026-09-09T00:00:00.000Z', progress_current: 0, progress_total: 0,
    error: null, can_retry: false, can_cancel: true, soft_locked: false,
    created_at: '2026-09-08T00:00:00.000Z', completed_at: null,
}

test('migration create and every action use the documented authenticated POST contracts', async () => {
    const requests: { url: string; init?: RequestInit }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json(migration)
    }) as unknown as typeof fetch
    const pb = new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false, apiKey: 'jwt' })
    const input = { service: 'bluesky', inputs: { handle: 'example.bsky.social' }, tenant_id: 'pack-id' }
    await expect(pb.migrations.create(input)).resolves.toEqual(migration)
    for (const action of ['verify', 'start', 'cancel', 'retry'] as const) {
        await expect(pb.migrations[action]('migration-id')).resolves.toEqual(migration)
    }
    expect(requests.map(request => request.url)).toEqual(
        ['create', 'verify', 'start', 'cancel', 'retry'].map(action => `https://api.example.test/migrate/${action}`),
    )
    requests.forEach((request, index) => {
        expect(request.init?.method).toBe('POST')
        expect(new Headers(request.init?.headers).get('Authorization')).toBe('Bearer jwt')
        expect(JSON.parse(String(request.init?.body))).toEqual(index === 0 ? input : { migration_id: 'migration-id' })
    })
})

test('migration policy and status skip HTTP caches and pending-read sharing', async () => {
    const requests: RequestInit[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(init!)
        return Response.json(String(input).endsWith('services.json') ? schema : { migrations: [migration], account_locked: false })
    }) as unknown as typeof fetch
    const pb = sdk()
    const values = await Promise.all([pb.migrations.services(), pb.migrations.services(), pb.migrations.status(), pb.migrations.status()])
    expect(requests).toHaveLength(4)
    expect(requests.every(request => request.cache === 'no-store')).toBe(true)
    expect(values[0]).toEqual(schema)
    expect(values[2]).toEqual({ migrations: [migration], account_locked: false })
})

test('migration requests forward cancellation', async () => {
    const controller = new AbortController()
    let signal: AbortSignal | null | undefined
    globalThis.fetch = (async (_: RequestInfo | URL, init?: RequestInit) => { signal = init?.signal; return Response.json(schema) }) as unknown as typeof fetch
    await sdk().migrations.services({ signal: controller.signal })
    expect(signal).toBe(controller.signal)
    controller.abort()
    await expect(sdk().migrations.status({ signal: controller.signal })).rejects.toThrow()
})

test('unsupported policy versions, fields, verification, and invalid limits fail closed', async () => {
    const invalid: unknown[] = [
        { ...schema, version: 2 },
        { ...schema, services: [{ ...schema.services[0], fields: [{ ...schema.services[0]!.fields[0], type: 'file' }] }] },
        { ...schema, services: [{ ...schema.services[0], verification: { method: 'oauth' } }] },
        { ...schema, services: [{ ...schema.services[0], limits: { max_posts: -1, max_migrations_per_account: null } }] },
        { ...schema, services: [{ ...schema.services[0], fields: [{ ...schema.services[0]!.fields[0], pattern: '[' }] }] },
        { ...schema, services: [{ ...schema.services[0], fields: [{ ...schema.services[0]!.fields[0], type: 'select', options: [] }] }] },
        { ...schema, services: [schema.services[0], schema.services[0]] },
    ]
    for (const value of invalid) {
        globalThis.fetch = (async () => Response.json(value)) as unknown as typeof fetch
        await expect(sdk().migrations.services()).rejects.toThrow('Invalid or unsupported migration services schema')
    }
})

test('invalid status and action records cannot reach consumers', async () => {
    for (const value of [
        { migrations: [migration], account_locked: 'false' },
        { migrations: [{ ...migration, policy: undefined }], account_locked: false },
        { migrations: [{ ...migration, policy: { ...migration.policy, enabled: 'true' } }], account_locked: false },
        { migrations: [{ ...migration, status: 'unknown' }], account_locked: false },
        { migrations: [{ ...migration, inputs: { handle: {} } }], account_locked: false },
        { migrations: [{ ...migration, can_cancel: undefined }], account_locked: false },
    ]) {
        globalThis.fetch = (async () => Response.json(value)) as unknown as typeof fetch
        await expect(sdk().migrations.status()).rejects.toThrow('Invalid migration status response')
    }
    globalThis.fetch = (async () => Response.json({ ...migration, progress_current: -1 })) as unknown as typeof fetch
    await expect(sdk().migrations.start('migration-id')).rejects.toThrow('Invalid migration response')
})
