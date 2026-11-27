import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'

/** Only controls outgoing mute preferences; never bypasses blocking. */
export type HowlReadContext = 'feed' | 'direct'

export interface VisibilityWatchOptions extends RequestOptions {
    cursor?: string
    /** Long-poll duration in milliseconds. The server defaults to 25,000. */
    waitMs?: number
}

/** Opaque change cursor; never contains relationship identities or reasons. */
export interface VisibilityWatchResult {
    cursor: string
    changed: boolean
}

export interface VisibilityResource {
    /** One uncached long poll, usable by guests and authenticated clients. */
    watch(options?: VisibilityWatchOptions): Promise<VisibilityWatchResult>
}

export function makeVisibility(http: HttpClient): VisibilityResource {
    return {
        async watch(options = {}) {
            const result = await http.getFresh<unknown>('/visibility/watch', options, {
                cursor: options.cursor,
                wait_ms: options.waitMs,
            })
            if (!result || typeof result !== 'object' ||
                typeof (result as VisibilityWatchResult).cursor !== 'string' ||
                typeof (result as VisibilityWatchResult).changed !== 'boolean') {
                throw new TypeError('Invalid visibility watch response.')
            }
            return {cursor: (result as VisibilityWatchResult).cursor, changed: (result as VisibilityWatchResult).changed}
        },
    }
}
