import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { SearchFeed } from '../search'
import type { ThemeRepositoryStatus } from './themes'

export interface CustomFeedCreateInput {
    /** 1-60 characters. Publishing syncs this from the repository's `meta.json`. */
    display_name: string
    /** Up to 300 characters. */
    description?: string
}

export interface CustomFeedUpdateInput {
    /** Unlisted feeds stay out of the directory but still run and can be pinned by link. */
    listed?: boolean
}

/** A member allowed to edit a feed besides its owner. */
export interface CustomFeedEditor {
    profile: {
        id: string
        username: string
        display_name: string | null
        images_avatar: string | null
    }
    granted_at: string
}

export interface CustomFeedCreateResult {
    id: string
    /** The feed's theme repository (`kind: 'feed'`); publish through `pb.themes('feed', id)`. */
    repository: ThemeRepositoryStatus
}

/** Custom feed writes. Reading and rendering go through `pb.search()` (`feeds` and `runFeed`). */
export interface CustomFeedsResource {
    create(input: CustomFeedCreateInput, options?: RequestOptions): Promise<CustomFeedCreateResult>
    /** Owner only. Returns the feed's `SearchFeed` row. */
    update(id: string, input: CustomFeedUpdateInput, options?: RequestOptions): Promise<SearchFeed>
    /** Owner only. Built-in feeds can't be deleted. */
    delete(id: string, options?: RequestOptions): Promise<void>
    /** Who may edit and publish the feed besides its owner. Anyone who may edit it can read this. */
    editors(id: string, options?: RequestOptions): Promise<CustomFeedEditor[]>
    /** Owner or staff. Idempotent; returns the updated list. */
    addEditor(id: string, username: string, options?: RequestOptions): Promise<CustomFeedEditor[]>
    /** Owner or staff, or an editor removing themselves. Idempotent. */
    removeEditor(id: string, userId: string, options?: RequestOptions): Promise<void>
    /** Idempotent. */
    pin(id: string, options?: RequestOptions): Promise<void>
    /** Idempotent. */
    unpin(id: string, options?: RequestOptions): Promise<void>
    /** Sets the order of the reader's pinned feeds. */
    reorder(ids: string[], options?: RequestOptions): Promise<void>
}

export function makeCustomFeeds(http: HttpClient): CustomFeedsResource {
    const path = (id: string) => `/feeds/custom/${encodeURIComponent(id)}`
    return {
        create: (input, options) => http.post('/feeds/custom', input, undefined, options),
        update: (id, input, options) => http.patch(path(id), input, options),
        delete: (id, options) => http.delete(path(id), undefined, options),
        editors: (id, options) => http.get(`${path(id)}/editors`, undefined, options),
        addEditor: (id, username, options) =>
            http.put(`${path(id)}/editors`, { username }, options),
        removeEditor: (id, userId, options) =>
            http.delete(`${path(id)}/editors/${encodeURIComponent(userId)}`, undefined, options),
        pin: (id, options) => http.put(`${path(id)}/pin`, undefined, options),
        unpin: (id, options) => http.delete(`${path(id)}/pin`, undefined, options),
        reorder: (ids, options) => http.put('/feeds/custom/pins/order', { ids }, options),
    }
}
