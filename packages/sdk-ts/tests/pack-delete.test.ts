import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK} from '../src'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('deleting a pack is explicit and separate from leaving membership', async () => {
    const requests: Array<{path: string; method?: string; body: unknown}> = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        requests.push({path: new URL(String(url)).pathname, method: init?.method, body: init?.body})
        return new Response(null, {status: 204})
    }) as typeof fetch
    const client = new PackbaseSDK({baseUrl: 'https://api.example.test', autoLogin: false})
    await client.packs('pack').delete()
    await client.packs('pack').leave()
    expect(requests[0]).toEqual({path: '/pack/pack', method: 'DELETE', body: JSON.stringify({confirm_pack_id: 'pack'})})
    expect(requests[1]?.path).toBe('/pack/pack/join')
})
