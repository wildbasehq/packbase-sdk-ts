import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type MaintenanceInput, type MaintenanceOperation, type MaintenancePreview } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const sdk = () => new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false, apiKey: 'jwt' })
const preview: MaintenancePreview = {
    token: 'review-token', kind: 'bulk_delete', tags: ['drawing'], own_count: 1, cascade_count: 1, total_count: 2,
    samples: [{ id: 'howl', content: null, created_at: '2026-09-10T00:00:00.000Z' }], has_more: false,
    server_time: '2026-09-10T01:00:00.000Z', confirm_after: '2026-09-10T01:00:10.000Z', expires_at: '2026-09-10T01:15:00.000Z',
}
const operation: MaintenanceOperation = {
    id: 'operation-id', kind: 'bulk_delete', status: 'queued', phase: 'delete',
    own_count: 1, cascade_count: 1, total_count: 2, deleted_count: 0, cleanup_total: 0, cleanup_completed: 0,
    error: null, can_retry: false, created_at: preview.server_time, updated_at: preview.server_time,
    completed_at: null, acknowledged_at: null,
}
function respond(value: unknown) {
    globalThis.fetch = (async () => Response.json(value)) as unknown as typeof fetch
}

test('maintenance preview, confirmation, recovery and acknowledgement use authenticated contracts', async () => {
    const requests: { url: string; init?: RequestInit }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json(String(input).endsWith('/preview') ? preview : operation)
    }) as unknown as typeof fetch
    const pb = sdk()
    await expect(pb.me.maintenance.preview({ kind: 'bulk_delete', tags: ['drawing'] })).resolves.toEqual(preview)
    const confirmation = { token: preview.token, username: 'rek' }
    await expect(pb.me.maintenance.confirm(confirmation)).resolves.toEqual(operation)
    await expect(pb.me.maintenance.confirm(confirmation)).resolves.toEqual(operation)
    await expect(pb.me.maintenance.retry('operation-id')).resolves.toEqual(operation)
    await expect(pb.me.maintenance.acknowledge('operation-id')).resolves.toEqual(operation)
    expect(requests.map(item => item.url)).toEqual(['preview', 'confirm', 'confirm', 'operation-id/retry', 'operation-id/acknowledge']
        .map(path => `https://api.example.test/user/me/maintenance/${path}`))
    expect(requests.map(item => JSON.parse(String(item.init?.body)))).toEqual([
        { kind: 'bulk_delete', tags: ['drawing'] }, confirmation, confirmation, {}, {},
    ])
    for (const { init } of requests) {
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    }
})

test('factory reset uses no tag filter and accepts an empty account preview', async () => {
    const empty: MaintenancePreview = { ...preview, kind: 'factory_reset', tags: [], own_count: 0, cascade_count: 0, total_count: 0, samples: [] }
    let body: unknown
    globalThis.fetch = (async (_: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(String(init?.body))
        return Response.json(empty)
    }) as unknown as typeof fetch
    await expect(sdk().me.maintenance.preview({ kind: 'factory_reset' })).resolves.toEqual(empty)
    expect(body).toEqual({ kind: 'factory_reset' })
})

test('current and status reads bypass HTTP caches and in-flight deduplication', async () => {
    const requests: { url: string; init?: RequestInit }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json(String(input).endsWith('/current') ? { operation: null, server_time: preview.server_time, last_reset_id: null } : operation)
    }) as unknown as typeof fetch
    const pb = sdk()
    const results = await Promise.all([pb.me.maintenance.current(), pb.me.maintenance.current(), pb.me.maintenance.status('operation-id'), pb.me.maintenance.status('operation-id')])
    expect(requests).toHaveLength(4)
    for (const { init } of requests) {
        expect(init?.cache).toBe('no-store')
        expect(init?.method).toBe('GET')
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt')
    }
    expect(results[0]).toEqual({ operation: null, server_time: preview.server_time, last_reset_id: null })
    expect(results[2]).toEqual(operation)
})

test('all maintenance methods forward AbortSignal and aborted work issues no request', async () => {
    const controller = new AbortController()
    let requests = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests++
        expect(init?.signal).toBe(controller.signal)
        const url = String(input)
        return Response.json(url.endsWith('/preview') ? preview : url.endsWith('/current') ? { operation, server_time: preview.server_time, last_reset_id: null } : operation)
    }) as unknown as typeof fetch
    const maintenance = sdk().me.maintenance
    const options = { signal: controller.signal }
    await maintenance.preview({ kind: 'bulk_delete', tags: ['drawing'] }, options)
    await maintenance.confirm({ token: 'token', username: 'rek' }, options)
    await maintenance.current(options)
    await maintenance.status('operation-id', options)
    await maintenance.retry('operation-id', options)
    await maintenance.acknowledge('operation-id', options)
    controller.abort()
    await expect(maintenance.current(options)).rejects.toThrow()
    await expect(maintenance.confirm({ token: 'token', username: 'rek' }, options)).rejects.toThrow()
    expect(requests).toBe(6)
})

test('server wait and scope-change errors propagate without automatic confirmation retries', async () => {
    for (const code of ['maintenance_wait_required', 'maintenance_scope_changed', 'maintenance_preview_expired']) {
        let requests = 0
        globalThis.fetch = (async () => { requests++; return Response.json({ code, summary: 'Review again' }, { status: 409 }) }) as unknown as typeof fetch
        try {
            await sdk().me.maintenance.confirm({ token: 'review-token', username: 'rek' })
            throw new Error('Expected failure')
        } catch (error) {
            expect(error).toMatchObject({ status: 409, code })
        }
        expect(requests).toBe(1)
    }
})

test('preview rejects malformed counts, nested samples, booleans, kinds and time bounds', async () => {
    for (const value of [
        null, [], { ...preview, kind: ['bulk_delete'] }, { ...preview, token: ' ' },
        { ...preview, own_count: -1 }, { ...preview, cascade_count: 0.5 }, { ...preview, total_count: 7 },
        { ...preview, samples: [{ ...preview.samples[0], content: false }] },
        { ...preview, samples: [{ ...preview.samples[0], created_at: null }] },
        { ...preview, samples: [null] }, { ...preview, has_more: 'false' },
        { ...preview, tags: [] }, { ...preview, tags: [null] }, { ...preview, kind: 'factory_reset' },
        { ...preview, server_time: 'bad-date' }, { ...preview, confirm_after: preview.expires_at },
        { ...preview, expires_at: preview.server_time },
    ]) {
        respond(value)
        await expect(sdk().me.maintenance.preview({ kind: 'bulk_delete', tags: ['drawing'] })).rejects.toThrow('Invalid maintenance preview response')
    }
})

test('operation and nested current state reject coerced enums, inconsistent progress and missing nullables', async () => {
    for (const value of [
        { ...operation, status: ['running'] }, { ...operation, phase: ['delete'] },
        { ...operation, id: null }, { ...operation, can_retry: 'false' }, { ...operation, total_count: 3 },
        { ...operation, deleted_count: 3 }, { ...operation, cleanup_completed: 1 },
        { ...operation, cleanup_total: Number.MAX_SAFE_INTEGER + 1 }, { ...operation, error: false },
        { ...operation, completed_at: undefined }, { ...operation, acknowledged_at: false }, { ...operation, updated_at: 'bad-date' },
    ]) {
        respond(value)
        await expect(sdk().me.maintenance.status('operation-id')).rejects.toThrow('Invalid maintenance operation response')
        respond({ operation: value, server_time: preview.server_time, last_reset_id: null })
        await expect(sdk().me.maintenance.current()).rejects.toThrow('Invalid current maintenance response')
    }
    for (const value of [{ operation: null }, { operation: undefined, server_time: preview.server_time, last_reset_id: null }, { operation: [], server_time: preview.server_time, last_reset_id: null }]) {
        respond(value)
        await expect(sdk().me.maintenance.current()).rejects.toThrow('Invalid current maintenance response')
    }
})

test('completed and failed records preserve null, false, timestamps and cleanup counts', async () => {
    const completed: MaintenanceOperation = { ...operation, status: 'completed', phase: 'complete', deleted_count: 2, cleanup_total: 3, cleanup_completed: 3,
        completed_at: preview.confirm_after, acknowledged_at: preview.confirm_after }
    respond(completed)
    await expect(sdk().me.maintenance.acknowledge('operation-id')).resolves.toEqual(completed)
    const failed: MaintenanceOperation = { ...operation, status: 'failed', phase: 'assets', deleted_count: 2, cleanup_total: 3, cleanup_completed: 1, error: 'Retry cleanup', can_retry: true }
    respond({ operation: failed, server_time: preview.server_time, last_reset_id: null })
    await expect(sdk().me.maintenance.current()).resolves.toEqual({ operation: failed, server_time: preview.server_time, last_reset_id: null })
})

test('malformed input is rejected locally while username spelling and tag order are forwarded unchanged', async () => {
    let requests = 0
    let body: unknown
    globalThis.fetch = (async (_: RequestInfo | URL, init?: RequestInit) => { requests++; body = JSON.parse(String(init?.body)); return Response.json(preview) }) as unknown as typeof fetch
    const maintenance = sdk().me.maintenance
    for (const input of [null, {}, { kind: 'bulk_delete', tags: [] }, { kind: 'bulk_delete', tags: [false] }, { kind: 'bulk_delete', tags: [' '] }, { kind: 'factory_reset', tags: ['drawing'] }]) {
        await expect(maintenance.preview(input as MaintenanceInput)).rejects.toThrow(TypeError)
    }
    for (const id of ['', ' ', '.', '..']) {
        await expect(maintenance.status(id)).rejects.toThrow(TypeError)
        await expect(maintenance.retry(id)).rejects.toThrow(TypeError)
        await expect(maintenance.acknowledge(id)).rejects.toThrow(TypeError)
    }
    await expect(maintenance.confirm({ token: '', username: 'rek' })).rejects.toThrow(TypeError)
    await expect(maintenance.confirm({ token: 'token', username: ' ' })).rejects.toThrow(TypeError)
    expect(requests).toBe(0)
    await maintenance.preview({ kind: 'bulk_delete', tags: ['Drawing', ' cats '] })
    expect(body).toEqual({ kind: 'bulk_delete', tags: ['Drawing', ' cats '] })
})

test('operation IDs are encoded as one URL segment', async () => {
    let url = ''
    globalThis.fetch = (async (input: RequestInfo | URL) => { url = String(input); return Response.json(operation) }) as unknown as typeof fetch
    await sdk().me.maintenance.status('id/with?reserved#characters')
    expect(url).toBe('https://api.example.test/user/me/maintenance/id%2Fwith%3Freserved%23characters')
})


test('current retains the latest confirmed reset after acknowledgement and without an active operation', async () => {
    const current = { operation: null, server_time: preview.server_time, last_reset_id: 'confirmed-reset-id' }
    respond(current)
    await expect(sdk().me.maintenance.current()).resolves.toEqual(current)
    respond({ ...current, operation })
    await expect(sdk().me.maintenance.current()).resolves.toEqual({ ...current, operation })
    for (const invalid of [undefined, false, 7, [], {}, '', ' ']) {
        respond({ ...current, last_reset_id: invalid })
        await expect(sdk().me.maintenance.current()).rejects.toThrow('Invalid current maintenance response')
    }
})
