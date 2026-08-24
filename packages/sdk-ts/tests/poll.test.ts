import { describe, expect, test } from 'bun:test'
import type { HttpClient } from '../src/http'
import { Poller } from '../src/poll'
import type { Howl, HowlJobStatus } from '../src/types/howl'

describe('Poller', () => {
    test('validates timing options before polling', async () => {
        const poller = new Poller({} as HttpClient)

        await expect(poller.waitFor('job', { intervalMs: -1 })).rejects.toThrow(
            'intervalMs must be a finite, non-negative number',
        )
        await expect(poller.waitFor('job', { timeoutMs: Number.NaN })).rejects.toThrow(
            'timeoutMs must be a finite, non-negative number',
        )
    })

    test('encodes job IDs and fetches completed howls', async () => {
        const paths: string[] = []
        const completedHowl = { id: 'job/one' } as Howl
        const http = {
            async get<T>(path: string): Promise<T> {
                paths.push(path)
                if (paths.length === 1) {
                    return { status: 'completed' } as T & HowlJobStatus
                }
                return completedHowl as T
            },
        } as HttpClient

        const poller = new Poller(http)

        await expect(poller.waitFor('job/one')).resolves.toBe(completedHowl)
        expect(paths).toEqual([
            '/howl/create/status/job%2Fone',
            '/howl/job%2Fone',
        ])
    })
})
