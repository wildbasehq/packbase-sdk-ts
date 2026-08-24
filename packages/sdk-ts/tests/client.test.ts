import { afterEach, expect, test } from 'bun:test'
import { PackbaseSDK, type Profile } from '../src'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('automatic login hydrates me and emits ready once', async () => {
    const profile: Profile = {
        id: 'profile-1',
        username: 'rek',
        display_name: 'Rek',
    }
    globalThis.fetch = (async (_input, _init) => Response.json(profile)) as typeof fetch

    const sdk = new PackbaseSDK({ baseUrl: 'https://api.example.test' })
    const readyProfiles: Profile[] = []
    const onReady = (readyProfile: Profile) => readyProfiles.push(readyProfile)
    sdk.on('ready', onReady)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(readyProfiles).toEqual([profile])
    expect(sdk.me.username).toBe('rek')

    sdk.off('ready', onReady)
})
