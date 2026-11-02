import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { FeedPage } from '../types/feed'

export class FeedHandle {
    constructor(
        private readonly http: HttpClient,
        private readonly id: string,
    ) {}

    fetch(options?: FeedFetchOptions): Promise<FeedPage> {
        return this.http.get<FeedPage>(`/feed/${this.id}`, {
            page: options?.page,
            media_only: options?.mediaOnly,
            include_pins_from: options?.includePinsFrom,
        }, options)
    }
}

export interface FeedFetchOptions extends RequestOptions {
    /** Only image/video howls, filtered before pagination; includes matching pins only. */
    mediaOnly?: boolean
    page?: number
    includePinsFrom?: string
}

export type FeedsFn = {
    (id: string): FeedHandle
}

export function makeFeeds(http: HttpClient): FeedsFn {
    return function feeds(id: string): FeedHandle {
        return new FeedHandle(http, id)
    }
}
