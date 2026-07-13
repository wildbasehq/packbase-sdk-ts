import { PackbaseError } from './errors'
import type { HttpClient } from './http'
import type { Howl, HowlJobStatus } from './types/howl'

/** Sleeps for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Options for controlling the polling loop in `Poller.waitFor`. */
export interface PollOptions {
    /**
     * How long to wait between status checks, in milliseconds.
     * @default 1000
     */
    intervalMs?: number

    /**
     * Maximum total time to wait before giving up, in milliseconds.
     * Throws `PackbaseError` with status 408 when exceeded.
     * @default 30000
     */
    timeoutMs?: number

    /**
     * Called after each status check, before the next sleep interval.
     * Useful for driving progress indicators.
     *
     * @param status - The latest job status returned by the server.
     */
    onProgress?: (status: HowlJobStatus) => void
}

/**
 * Drives the polling loop for async howl creation jobs.
 *
 * Howl creation on the server is async. `POST /howl/create` enqueues a
 * background job and returns immediately with a job ID. The Poller repeatedly
 * calls `GET /howl/create/status/:id` until the job completes, then fetches
 * and returns the finished howl.
 *
 * You should not need to use this directly. Use `pb.howls.create(...)`, which
 * calls `Poller.waitFor` automatically.
 */
export class Poller {
    constructor(private readonly http: HttpClient) { }

    /**
     * Polls `GET /howl/create/status/:jobId` until the job is done,
     * then fetches and returns the finished `Howl`.
     *
     * Polls every `intervalMs` milliseconds. Throws if the job fails or if
     * `timeoutMs` is exceeded before the job completes.
     *
     * The job ID and howl ID are the same UUID, so once the status is
     * `'completed'`, the howl is fetched at `GET /howl/:jobId`.
     *
     * @param jobId - The UUID returned by `POST /howl/create`.
     * @param options - Polling intervals, timeout, and progress callback.
     * @returns The completed `Howl` object.
     *
     * @throws `PackbaseError` (status 500) if the job status is `'failed'`.
     * @throws `PackbaseError` (status 408) if the timeout is exceeded.
     *
     * @example
     * ```ts
     * const howl = await poller.waitFor(jobId, {
     *   intervalMs: 500,
     *   onProgress: (s) => console.log(s.progress),
     * })
     * ```
     */
    async waitFor(jobId: string, options: PollOptions = {}): Promise<Howl> {
        const { intervalMs = 1000, timeoutMs = 30_000, onProgress } = options
        const deadline = Date.now() + timeoutMs

        while (Date.now() < deadline) {
            const status = await this.http.get<HowlJobStatus>(
                `/howl/create/status/${jobId}`,
                undefined,
                {cache: false},
            )

            onProgress?.(status)

            if (status.status === 'completed') {
                return this.http.get<Howl>(`/howl/${jobId}`, undefined, {cache: false})
            }

            if (status.status === 'failed') {
                throw new PackbaseError(500, status.error ?? 'Howl creation failed')
            }

            await sleep(intervalMs)
        }

        throw new PackbaseError(408, `Howl creation job ${jobId} timed out after ${timeoutMs}ms`)
    }
}
