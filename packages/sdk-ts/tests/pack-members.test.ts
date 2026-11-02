import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type PackMemberPage } from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const member = (id: string, membership_id: string) => ({
    id, membership_id, username: id, display_name: id, joined_at: '2026-10-24T00:00:00Z', permissions: 256,
})
const sdk = () => new PackbaseSDK({ baseUrl: 'https://api.example.test', autoLogin: false })

test('member pages keep exact cursors, query identity and request cancellation', async () => {
    const requests: Array<{ url: URL; signal: AbortSignal | null | undefined }> = []
    const response: PackMemberPage = { data: [member('one', '9007199254740993')], has_more: true, cursor: '9007199254740993' }
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        requests.push({ url: new URL(String(input)), signal: init?.signal })
        return Response.json(requests.length === 1 ? response : { data: [member('tail', '1')], has_more: false })
    }) as unknown as typeof fetch
    const client = sdk()
    const controller = new AbortController()
    const first = await client.packs('pack').members({ limit: 50, signal: controller.signal })
    await client.packs('pack').members({ limit: 50, cursor: first.cursor, signal: controller.signal })
    expect(requests).toHaveLength(2)
    expect(first.data[0]!.membership_id).toBe('9007199254740993')
    expect(requests[0]!.url.searchParams.get('limit')).toBe('50')
    expect(requests[1]!.url.searchParams.get('cursor')).toBe('9007199254740993')
    expect(requests[0]!.signal).toBe(controller.signal)
})

test('explicit lookup finds members beyond page one and stops fetching at a match', async () => {
    let calls = 0
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
        calls++
        const cursor = new URL(String(input)).searchParams.get('cursor')
        return Response.json(cursor
            ? { data: [member('target', '1')], has_more: false }
            : { data: [member('other', '9007199254740993')], has_more: true, cursor: '9007199254740993' })
    }) as unknown as typeof fetch
    expect((await sdk().packs('pack').findMember('target'))?.id).toBe('target')
    expect(calls).toBe(2)
})

test('lookup handles empty exhausted tails and cannot loop on repeated cursors', async () => {
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => Response.json(new URL(String(input)).searchParams.has('cursor')
        ? { data: [], has_more: false }
        : { data: [member('other', '2')], has_more: true, cursor: '2' })) as unknown as typeof fetch
    expect(await sdk().packs('pack').findMember('absent')).toBeUndefined()
    globalThis.fetch = (async () => Response.json({ data: [member('other', '2')], has_more: true, cursor: '2' })) as unknown as typeof fetch
    await expect(sdk().packs('pack').findMember('absent')).rejects.toThrow('cursor progression')
})

test('lookup cancels between pages instead of issuing the next request', async () => {
    const controller = new AbortController()
    let calls = 0
    globalThis.fetch = (async () => {
        calls++
        controller.abort()
        return Response.json({ data: [member('other', '2')], has_more: true, cursor: '2' })
    }) as unknown as typeof fetch
    await expect(sdk().packs('pack').findMember('absent', { signal: controller.signal })).rejects.toThrow()
    expect(calls).toBe(1)
})

test('members rejects the obsolete array response and preserves role-overflow errors', async () => {
    globalThis.fetch = (async () => Response.json([member('one', '1')])) as unknown as typeof fetch
    await expect(sdk().packs('pack').members()).rejects.toThrow('Invalid pack member page')
    globalThis.fetch = (async () => Response.json({ code: 'MEMBER_ROLE_LIMIT', summary: 'Too many roles' }, { status: 413 })) as unknown as typeof fetch
    await expect(sdk().packs('pack').members()).rejects.toMatchObject({ status: 413, code: 'MEMBER_ROLE_LIMIT' })
})
