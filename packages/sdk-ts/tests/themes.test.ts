import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK } from '../src'
const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})
test('theme controls encode owners, preserve revision inputs and use session auth', async () => {
    const calls: { url: URL; init: RequestInit }[] = []
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        calls.push({ url: new URL(String(url)), init: init! })
        return init?.method === 'DELETE'
            ? new Response(null, { status: 204 })
            : Response.json({})
    }) as typeof fetch
    const repo = new PackbaseSDK({
        baseUrl: 'https://api.example.test',
        apiKey: 'session',
        autoLogin: false,
    }).themes('profile', 'owner/id')
    const signal = new AbortController().signal
    await repo.status({ signal })
    await repo.rotateCredential()
    await repo.file('abc', 'pages/a b/page.html')
    await repo.publish('abc', null)
    await repo.disable('abc')
    await repo.page('about', true)
    await repo.revokeCredential()
    await repo.saveFile('abc', 'pages/a b/page.html', '<h2>Saved</h2>', { signal })
    await repo.changeFiles('abc', { action: 'create_folder', path: 'pages/new' }, { signal })
    await repo.changes('abc', 'style.css', { signal })
    await repo.workspace({ signal })
    await repo.workspaceFile('version', 'pages/profile.html', { signal })
    await repo.workspaceChanges('version', 'style.css', { signal })
    await repo.changeWorkspace('version', { action: 'save', path: 'style.css', content: 'body {}' }, { signal })
    await repo.commitWorkspace('version', 'Update theme', { signal })
    await repo.stageWorkspace('version', ['style.css'], true, { signal })
    await repo.stagedWorkspaceChanges('version', 'style.css', { signal })
    await repo.commitStagedWorkspace('version', 'Commit CSS', { signal })
    await repo.workspaceSnapshot('version', 'assets/photo.png', false, { signal })
    await repo.commitLocalWorkspace('version', 'Local snapshot', { base_revision: 'base', files: [{ path: 'style.css', content: 'Ym9keSB7fQ==' }] }, { signal })
    await repo.resetWorkspaceToTemplate('version', { signal })
    await repo.discardWorkspace('version', { signal })
    expect(calls[0]!.url.pathname).toBe(
        '/theme-repositories/profile/owner%2Fid',
    )
    expect(calls[0]!.init.signal).toBe(signal)
    expect(calls[2]!.url.searchParams.get('path')).toBe('pages/a b/page.html')
    expect(JSON.parse(calls[3]!.init.body as string)).toEqual({
        revision: 'abc',
        expected_revision: null,
    })
    expect(JSON.parse(calls[4]!.init.body as string)).toEqual({
        expected_revision: 'abc',
    })
    expect(calls[5]!.url.pathname).toBe('/theme-pages/profile/owner%2Fid')
    expect(calls[5]!.url.searchParams.get('maturity_confirmed')).toBe('true')
    expect(calls[7]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/file')
    expect(calls[7]!.init.method).toBe('POST')
    expect(calls[7]!.init.signal).toBe(signal)
    expect(JSON.parse(calls[7]!.init.body as string)).toEqual({ expected_revision: 'abc', path: 'pages/a b/page.html', content: '<h2>Saved</h2>' })
    expect(calls[8]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/changes')
    expect(JSON.parse(calls[8]!.init.body as string)).toEqual({ expected_revision: 'abc', change: { action: 'create_folder', path: 'pages/new' } })
    expect(calls[9]!.url.searchParams.get('revision')).toBe('abc')
    expect(calls[9]!.url.searchParams.get('path')).toBe('style.css')
    expect(calls[9]!.init.signal).toBe(signal)
    expect(calls[10]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace')
    expect(calls[11]!.url.searchParams.get('version')).toBe('version')
    expect(calls[12]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace/changes')
    expect(JSON.parse(calls[13]!.init.body as string)).toEqual({ version: 'version', change: { action: 'save', path: 'style.css', content: 'body {}' } })
    expect(JSON.parse(calls[14]!.init.body as string)).toEqual({ version: 'version', message: 'Update theme' })
    expect(calls[15]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace/stage')
    expect(JSON.parse(calls[15]!.init.body as string)).toEqual({ version: 'version', paths: ['style.css'], staged: true })
    expect(calls[16]!.url.searchParams.get('staged')).toBe('true')
    expect(calls[16]!.init.signal).toBe(signal)
    expect(JSON.parse(calls[17]!.init.body as string)).toEqual({ version: 'version', message: 'Commit CSS', staged_only: true })
    expect(calls[18]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace/snapshot')
    expect(calls[18]!.url.searchParams.get('staged')).toBe('false')
    expect(calls[18]!.init.signal).toBe(signal)
    expect(calls[19]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace/commit-local')
    expect(JSON.parse(calls[19]!.init.body as string)).toEqual({ version: 'version', message: 'Local snapshot', snapshot: { base_revision: 'base', files: [{ path: 'style.css', content: 'Ym9keSB7fQ==' }] } })
    expect(calls[20]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace/reset-template')
    expect(JSON.parse(calls[20]!.init.body as string)).toEqual({ version: 'version' })
    expect(calls[21]!.url.pathname).toBe('/theme-repositories/profile/owner%2Fid/workspace/discard')
    expect(JSON.parse(calls[21]!.init.body as string)).toEqual({ version: 'version' })
    expect(calls[21]!.init.signal).toBe(signal)
    for (const call of calls)
        expect(new Headers(call.init.headers).get('Authorization')).toBe(
            'Bearer session',
        )
})
