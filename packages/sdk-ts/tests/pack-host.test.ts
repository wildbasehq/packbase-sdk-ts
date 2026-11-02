import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK, PackPermissionBits, type PackActivityRange, type PackActivityPoint, type PackActivityTrend, type PackInsights, type PackInsightsOptions, type PackUnansweredOptions} from '../src'
const originalFetch = globalThis.fetch
afterEach(() => {globalThis.fetch = originalFetch})
const sdk = () => new PackbaseSDK({baseUrl:'https://api.example.test',autoLogin:false})
test('joining preserves request options and sends an explicitly accepted version', async () => {
    const requests: RequestInit[] = []
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { requests.push(init!); return Response.json({tenant_id:'pack',user_id:'me'}) }) as typeof fetch
    const signal = new AbortController().signal
    await sdk().packs('pack').join({signal})
    await sdk().packs('pack').join({signal,rulesVersion:3})
    expect(requests[0]!.body).toBeUndefined()
    expect(requests[0]!.signal).toBe(signal)
    expect(JSON.parse(requests[1]!.body as string)).toEqual({rules_version:3})
})
test('host resources preserve cancellation, paging and safe path segments', async () => {
    const requests: Array<{url: URL; init: RequestInit}> = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {requests.push({url:new URL(String(url)),init:init!}); return Response.json({data:[],has_more:false})}) as typeof fetch
    const signal = new AbortController().signal
    const host = sdk().packs('pack',{signal}).host
    await host.reports({status:'open',cursor:'next',limit:20})
    await host.publishRules({expected_version:2,rules:[{title:'Be kind',body:'Respect others.'}]})
    await host.reportAction('report/id',{action:'escalate',explanation:'Platform review needed.'})
    expect(requests[0]!.url.pathname).toBe('/pack/pack/reports')
    expect(requests[0]!.url.searchParams.get('cursor')).toBe('next')
    expect(requests[0]!.url.searchParams.get('status')).toBe('open')
    expect(requests.every(item=>item.init.signal===signal)).toBe(true)
    expect(JSON.parse(requests[1]!.init.body as string).expected_version).toBe(2)
    expect(requests[2]!.url.pathname).toBe('/pack/pack/reports/report%2Fid/actions')
    expect(PackPermissionBits.ManagePackReports).toBe(8192)
})

test('activity ranges preserve timestamp offsets, trend timezone, pagination, and request options', async () => {
    const requests: Array<{url: URL; init: RequestInit}> = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        requests.push({url: new URL(String(url)), init: init!})
        return Response.json({data: [], has_more: false})
    }) as typeof fetch
    const defaults = new AbortController().signal
    const signal = new AbortController().signal
    const host = sdk().packs('pack/id', {signal: defaults}).host
    const range: PackActivityRange = {from: '2026-10-01T00:00:00+10:00', to: '2026-10-26T00:00:00+11:00'}
    const insightsOptions: PackInsightsOptions = {...range, timezone: 'Australia/Melbourne', signal}
    const unansweredOptions: PackUnansweredOptions = {...range, cursor: 'page/2+', limit: 25}

    await host.insights()
    await host.insights({signal})
    await host.insights(insightsOptions)
    await host.unanswered({cursor: 'legacy', limit: 20, signal})
    await host.unanswered(unansweredOptions)

    expect(requests[0]!.url.pathname).toBe('/pack/pack%2Fid/insights')
    expect(requests[0]!.url.search).toBe('')
    expect(requests[0]!.init.signal).toBe(defaults)
    expect(requests[1]!.url.search).toBe('')
    expect(requests[1]!.init.signal).toBe(signal)
    expect(Object.fromEntries(requests[2]!.url.searchParams)).toEqual({...range, timezone: 'Australia/Melbourne'})
    expect(requests[2]!.url.search).toContain('timezone=Australia%2FMelbourne')
    expect(requests[2]!.init.signal).toBe(signal)
    expect(Object.fromEntries(requests[3]!.url.searchParams)).toEqual({cursor: 'legacy', limit: '20'})
    expect(requests[3]!.init.signal).toBe(signal)
    expect(requests[4]!.url.pathname).toBe('/pack/pack%2Fid/unanswered')
    expect(Object.fromEntries(requests[4]!.url.searchParams)).toEqual({...range, cursor: 'page/2+', limit: '25'})
    expect(requests[4]!.init.signal).toBe(defaults)
})

test('insights exposes typed trend buckets with zero counts and distinct contributors', async () => {
    const points: PackActivityPoint[] = [
        {from: '2026-10-23T13:00:00.000Z', to: '2026-10-24T13:00:00.000Z', members: 0, posts: 1, replies: 1, contributors: 2},
        {from: '2026-10-24T13:00:00.000Z', to: '2026-10-25T13:00:00.000Z', members: 2, posts: 3, replies: 1, contributors: 2},
        {from: '2026-10-25T13:00:00.000Z', to: '2026-10-26T00:00:00.000Z', members: 0, posts: 0, replies: 0, contributors: 0},
    ]
    const trend: PackActivityTrend = {interval: 'day', timezone: 'Australia/Melbourne', points}
    const response: PackInsights = {
        current: {members: 2, posts: 4, replies: 2, contributors: 2},
        previous: {members: 0, posts: 1, replies: 0, contributors: 1},
        from: points[0]!.from,
        to: points[2]!.to,
        previous_from: '2026-10-21T02:00:00.000Z',
        previous_to: points[0]!.from,
        trend,
    }
    let requestUrl: URL | undefined
    globalThis.fetch = (async (url: unknown) => {
        requestUrl = new URL(String(url))
        return Response.json(response)
    }) as typeof fetch

    const result: PackInsights = await sdk().packs('pack').host.insights({timezone: 'Australia/Melbourne'})

    expect(Object.fromEntries(requestUrl!.searchParams)).toEqual({timezone: 'Australia/Melbourne'})
    expect(result).toEqual(response)
    expect(result.trend.points[2]!.contributors).toBe(0)
    expect(result.trend.points.reduce((total, point) => total + point.contributors, 0)).toBe(4)
    expect(result.current.contributors).toBe(2)
})

test('deferred rule changes remain actionable conflicts with the latest version', async () => {
    const { Poller } = await import('../src/poll')
    const { PackbaseError } = await import('../src/errors')
    const http = {get: async () => ({status:'failed',error:'Review the latest pack rules.',error_code:'PACK_RULES_ACCEPTANCE_REQUIRED',rules_version:4})}
    const poller = new Poller(http as unknown as import('../src/http').HttpClient)
    try { await poller.waitFor('job'); throw new Error('Expected rules conflict') } catch(error) {
        expect(error).toBeInstanceOf(PackbaseError)
        expect((error as InstanceType<typeof PackbaseError>).status).toBe(409)
        expect((error as InstanceType<typeof PackbaseError>).code).toBe('PACK_RULES_ACCEPTANCE_REQUIRED')
        expect((error as InstanceType<typeof PackbaseError>).raw?.rules_version).toBe(4)
    }
})
