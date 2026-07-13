import {expect, test} from 'bun:test'
import {PackbaseSDK} from '../src'

test('resource handles defer their request until awaited', async () => {
    const packId = '11111111-1111-4111-8111-111111111111'
    const requests: string[] = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL) => {
        requests.push(String(input))
        return new Response(JSON.stringify({id: 'id', username: 'rek'}), {
            headers: {'Content-Type': 'application/json'},
        })
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()
        await Promise.resolve()

        const requestsBeforeHandle = requests.length
        const pack = pb.packs(packId)

        expect(requests).toHaveLength(requestsBeforeHandle)

        await pack

        expect(requests).toHaveLength(requestsBeforeHandle + 1)
        expect(requests.at(-1)).toBe(`https://vgs.packbase.app/pack/${packId}`)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('waitlist referral methods send the Clerk entry ID as a query parameter', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push({url, init})

        if (url.includes('/invite/my-referral')) {
            return Response.json({
                code: 'ABCD1234',
                url: 'https://packbase.app/id/create?ref=ABCD1234',
                referrals: 2,
                priority: 20,
            })
        }

        if (url.includes('/invite/redeem-referral')) {
            return Response.json({success: true, referrer_code: 'EFGH5678'})
        }

        return Response.json({id: 'id', username: 'rek'})
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()
        const waitlistId = 'wle_123&private=true'

        const referral = await pb.invites.getWaitlistReferral(waitlistId)
        const redeemed = await pb.invites.redeemWaitlistReferral(waitlistId, 'efgh5678')

        expect(referral.code).toBe('ABCD1234')
        expect(redeemed.referrer_code).toBe('EFGH5678')

        const getRequest = requests.find(({url}) => url.includes('/invite/my-referral'))
        expect(getRequest?.url).toBe(
            'https://vgs.packbase.app/invite/my-referral?id=wle_123%26private%3Dtrue',
        )
        expect(getRequest?.init?.method).toBe('GET')

        const postRequest = requests.find(({url}) => url.includes('/invite/redeem-referral'))
        expect(postRequest?.url).toBe(
            'https://vgs.packbase.app/invite/redeem-referral?id=wle_123%26private%3Dtrue',
        )
        expect(postRequest?.init?.method).toBe('POST')
        expect(postRequest?.init?.body).toBe(JSON.stringify({code: 'efgh5678'}))
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('GET caching is optional and can be overridden per call', async () => {
    const cachedPackId = '22222222-2222-4222-8222-222222222222'
    const overridePackId = '33333333-3333-4333-8333-333333333333'
    const uncachedPackId = '44444444-4444-4444-8444-444444444444'
    const requestCounts = new Map<string, number>()
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        requestCounts.set(url, (requestCounts.get(url) ?? 0) + 1)
        return Response.json({
            id: 'id',
            display_name: 'Cached pack',
            created_at: '2026-01-01T00:00:00.000Z',
            username: 'rek',
        })
    }) as unknown as typeof fetch

    try {
        const namespace = `cache-options-${Date.now()}`
        const cached = new PackbaseSDK({cache: true, cacheNamespace: namespace})
        const uncached = new PackbaseSDK({cache: false, cacheNamespace: `${namespace}-off`})
        const cachedUrl = `https://vgs.packbase.app/pack/${cachedPackId}`
        const overrideUrl = `https://vgs.packbase.app/pack/${overridePackId}`
        const uncachedUrl = `https://vgs.packbase.app/pack/${uncachedPackId}`

        await cached.packs(cachedPackId)
        await cached.packs(cachedPackId)
        expect(requestCounts.get(cachedUrl)).toBe(1)

        await cached.packs(cachedPackId, {cache: false})
        expect(requestCounts.get(cachedUrl)).toBe(2)

        await uncached.packs(uncachedPackId)
        await uncached.packs(uncachedPackId)
        expect(requestCounts.get(uncachedUrl)).toBe(2)

        await uncached.packs(overridePackId, {cache: true})
        await uncached.packs(overridePackId, {cache: true})
        expect(requestCounts.get(overrideUrl)).toBe(1)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('cached GETs coalesce and successful writes invalidate their namespace', async () => {
    const packId = '55555555-5555-4555-8555-555555555555'
    const requests: Array<{method: string; url: string}> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({method: init?.method ?? 'GET', url: String(input)})
        return Response.json({
            id: 'id',
            display_name: 'Shared pack',
            created_at: '2026-01-01T00:00:00.000Z',
            username: 'rek',
        })
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK({
            cache: true,
            cacheNamespace: `cache-invalidation-${Date.now()}`,
        })
        const url = `https://vgs.packbase.app/pack/${packId}`

        await Promise.all([
            pb.packs(packId),
            pb.packs(packId),
            pb.packs(packId),
        ])
        expect(requests.filter(request => request.url === url)).toHaveLength(1)

        await pb.packs(packId).update({about: {bio: 'Updated'}})
        await pb.packs(packId)

        expect(
            requests.filter(request => request.url === url && request.method === 'GET'),
        ).toHaveLength(2)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('profile actions match the server routes and verbs', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({url: String(input), init})
        return Response.json({id: 'ticket-id', status: 'pending', username: 'rek'})
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()

        await pb.profiles('other user').follow()
        await pb.profiles('other user').unfollow()
        await pb.profiles('other user').report('Spam', 'Repeated posts')
        await pb.profiles('other user').history({
            from: new Date('2026-01-01T00:00:00.000Z'),
            axis: 'decision',
            limit: 10,
        })

        const actionRequests = requests.filter(({url}) => url.includes('/user/other%20user/'))
        expect(actionRequests.map(({init}) => init?.method)).toEqual(['POST', 'DELETE', 'POST', 'GET'])
        expect(actionRequests[2]?.init?.body).toBe(JSON.stringify({
            reason: 'Spam',
            notes: 'Repeated posts',
        }))
        expect(actionRequests[3]?.url).toBe(
            'https://vgs.packbase.app/user/other%20user/history?from=2026-01-01T00%3A00%3A00.000Z&axis=decision&limit=10',
        )
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('pack moderation and inbox deletion use the current server endpoints', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({url: String(input), init})
        return Response.json({success: true, count: 2})
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()
        const pack = pb.packs('pack-id')

        await pack.ban('user-id')
        await pack.kick('user-id')
        await pb.inbox.delete(['notification-1', 'notification-2'])
        await pb.inbox.delete('all')

        const ban = requests.find(({url}) => url.endsWith('/pack/pack-id/member/user-id/ban'))
        const kick = requests.find(({url}) => url.endsWith('/pack/pack-id/member/user-id/kick'))
        const deletions = requests.filter(({url}) => url.endsWith('/inbox/delete'))

        expect(ban?.init?.method).toBe('POST')
        expect(kick?.init?.method).toBe('POST')
        expect(deletions.map(({init}) => init?.method)).toEqual(['POST', 'POST'])
        expect(deletions[0]?.init?.body).toBe(JSON.stringify({ids: ['notification-1', 'notification-2']}))
        expect(deletions[1]?.init?.body).toBe(JSON.stringify({all: true}))
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('account, invite, store, and folder methods send the required payloads', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({url: String(input), init})
        return Response.json({
            id: 'id',
            username: 'rek',
            invite_id: 'invite-id',
            created_at: '2026-01-01T00:00:00.000Z',
            items: [],
            folders: [],
        })
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()

        await pb.me.setBadge('founder')
        await pb.invites.generate('person@example.com')
        await pb.store.purchase('gold badge', {quantity: 2})
        await pb.folders.list('user/id')

        const badge = requests.find(({url}) => url.endsWith('/user/me/badge'))
        const invite = requests.find(({url}) => url.endsWith('/invite/generate'))
        const purchase = requests.find(({url}) => url.endsWith('/store/gold%20badge'))
        const folders = requests.find(({url}) => url.includes('/folders?'))

        expect(badge?.init?.body).toBe(JSON.stringify({badge: 'founder'}))
        expect(invite?.init?.body).toBe(JSON.stringify({email: 'person@example.com'}))
        expect(purchase?.init?.body).toBe(JSON.stringify({quantity: 2}))
        expect(folders?.url).toBe('https://vgs.packbase.app/folders?user=user%2Fid')
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('howl creation sends the canonical text body contract', async () => {
    const requests: Array<{url: string; init?: RequestInit}> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({url: String(input), init})
        return Response.json({id: 'howl-id'})
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()

        await pb.howls.create({
            tenant_id: '11111111-1111-4111-8111-111111111111',
            body: '<p>Hello</p>',
            tags: ['rating_safe'],
        }, {poll: false})

        const request = requests.find(({url}) => url.endsWith('/howl/create'))
        expect(request?.init?.method).toBe('POST')
        expect(JSON.parse(String(request?.init?.body))).toEqual({
            tenant_id: '11111111-1111-4111-8111-111111111111',
            content_type: 'text',
            body: '<p>Hello</p>',
            tags: ['rating_safe'],
        })
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('howl creation rejects object bodies before making a request', async () => {
    const originalFetch = globalThis.fetch
    const requests: string[] = []

    globalThis.fetch = (async (input: RequestInfo | URL) => {
        requests.push(String(input))
        return Response.json({id: 'unexpected'})
    }) as unknown as typeof fetch

    try {
        const pb = new PackbaseSDK()
        const invalid = {
            tenant_id: '11111111-1111-4111-8111-111111111111',
            body: {type: 'doc'},
            tags: ['rating_safe'],
        } as unknown as Parameters<typeof pb.howls.create>[0]

        await expect(pb.howls.create(invalid, {poll: false})).rejects.toThrow(
            'Howl body must be a string or null.',
        )
        expect(requests.some(url => url.endsWith('/howl/create'))).toBe(false)
    } finally {
        globalThis.fetch = originalFetch
    }
})
