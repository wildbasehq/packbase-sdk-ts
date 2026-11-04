import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK, type Pack} from '../src'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('profile packs use one dedicated request, escape identifiers, inherit cancellation and read fresh', async () => {
    const requests: Array<{url: string; options?: RequestInit}> = []
    const packs: Pack[] = [{id: 'shared-pack', display_name: 'Shared pack', feed_type: 'list', created_at: '2026-11-03T00:00:00Z'}]
    globalThis.fetch = (async (input, options) => {
        requests.push({url: String(input), options})
        return Response.json(packs)
    }) as typeof fetch
    const client = new PackbaseSDK({baseUrl: 'https://api.example.test', apiKey: 'token', autoLogin: false})
    const inherited = new AbortController().signal
    const override = new AbortController().signal
    const profile = client.profiles('member/name', {signal: inherited})
    expect(await profile.packs()).toEqual(packs)
    expect(await profile.packs({signal: override})).toEqual(packs)
    expect(requests).toHaveLength(2)
    expect(requests.map(r => r.url)).toEqual(Array(2).fill('https://api.example.test/user/member%2Fname/packs'))
    expect(requests[0]?.options?.signal).toBe(inherited)
    expect(requests[1]?.options?.signal).toBe(override)
})

test('profile packs propagate errors rather than treating failures as empty memberships', async () => {
    globalThis.fetch = (async () => Response.json({summary: 'Profile not found'}, {status: 404})) as unknown as typeof fetch
    const client = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    await expect(client.profiles('missing').packs()).rejects.toMatchObject({status: 404})
})
