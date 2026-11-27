import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK, type AccessCode} from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('direct-access codes use separate typed routes from email invites and waitlist referrals', async () => {
    const requests: Array<{url: string; method: string; body?: unknown; authorization: string | null}> = []
    const code: AccessCode = {
        id: 'code/id', code: 'PB-TEST', url: 'https://packbase.app/id/create?ic=PB-TEST',
        created_at: '2026-11-02T00:00:00.000Z', status: 'active', credited_user_id: 'member-id',
        credited_username: 'member', created_by_me: true,
    }
    globalThis.fetch = (async (input, init) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        requests.push({
            url, method,
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
            authorization: new Headers(init?.headers).get('Authorization'),
        })
        if (url.includes('/credited-users')) {
            return Response.json({users: [{id: 'member-id', username: 'member', display_name: null, images_avatar: null}]})
        }
        if (url.endsWith('/access-codes/claim') || url.endsWith('/revoke')) {
            return Response.json({success: true})
        }
        if (url.endsWith('/access-codes') && method === 'POST') return Response.json(code)
        return Response.json({codes: [code], allowance: {remaining: 1, next_refresh_at: null}, next_cursor: null})
    }) as typeof fetch

    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false, apiKey: 'token'})
    expect((await sdk.invites.listAccessCodes({cursor: 'next cursor'})).codes[0]?.code).toBe('PB-TEST')
    expect(await sdk.invites.createAccessCode()).toEqual(code)
    expect(await sdk.invites.createAccessCode({credited_user_id: 'member-id', max_uses: 99})).toEqual(code)
    expect(await sdk.invites.claimAccessCode('PB-TEST', 'person@example.test')).toEqual({success: true})
    expect(await sdk.invites.revokeAccessCode('code/id')).toBeUndefined()
    expect((await sdk.invites.searchCreditedUsers('A & B'))[0]?.username).toBe('member')

    expect(requests.map(({url, method, body}) => ({url, method, body}))).toEqual([
        {url: 'https://api.example.test/invite/access-codes?cursor=next+cursor', method: 'GET', body: undefined},
        {url: 'https://api.example.test/invite/access-codes', method: 'POST', body: {}},
        {url: 'https://api.example.test/invite/access-codes', method: 'POST', body: {credited_user_id: 'member-id', max_uses: 99}},
        {url: 'https://api.example.test/invite/access-codes/claim', method: 'POST', body: {code: 'PB-TEST', email: 'person@example.test'}},
        {url: 'https://api.example.test/invite/access-codes/code%2Fid/revoke', method: 'POST', body: {}},
        {url: 'https://api.example.test/invite/credited-users?query=A+%26+B', method: 'GET', body: undefined},
    ])
    expect(requests.every(({authorization}) => authorization === 'Bearer token')).toBe(true)
})

test('a guest can claim a code without an authenticated SDK client', async () => {
    let request: RequestInit | undefined
    globalThis.fetch = (async (_input, init) => {
        request = init
        return Response.json({success: true})
    }) as typeof fetch

    const sdk = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    expect(await sdk.invites.claimAccessCode('PB-TEST', 'person@example.test')).toEqual({success: true})
    expect(request?.credentials).toBe('include')
    expect(new Headers(request?.headers).has('Authorization')).toBe(false)
})
