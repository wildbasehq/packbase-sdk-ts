import type { HttpClient } from '../http'
import type { RequestOptions } from '../cache'
import type { Notification } from '../types/inbox'
import type { Paginated } from '../types/common'

/** Options for `pb.inbox.fetch`. */
export interface FetchInboxOptions extends RequestOptions {
    /**
     * Maximum number of notifications to return.
     * The server default applies when omitted.
     */
    limit?: number

    /**
     * Pagination cursor from a previous response.
     * Pass `cursor` from the last result to load the next page.
     */
    cursor?: string

    /**
     * When `true`, only unread notifications are returned.
     * @default false
     */
    unreadOnly?: boolean
}

/**
 * Methods available on `pb.inbox`.
 *
 * ```ts
 * const { data, has_more } = await pb.inbox.fetch({ unreadOnly: true })
 * const { count } = await pb.inbox.count()
 * await pb.inbox.markRead(['id1', 'id2'])
 * await pb.inbox.markRead('all')
 * await pb.inbox.delete(['id1'])
 * ```
 */
export interface InboxResource {
    /**
     * Fetches notifications for the authenticated user (`GET /inbox/fetch`).
     *
     * Results are paginated. Pass `cursor` from a previous response to
     * fetch the next page.
     *
     * @param options - Filtering and pagination options.
     * @returns A paginated result containing notifications and a `has_more` flag.
     */
    fetch(options?: FetchInboxOptions): Promise<Paginated<Notification>>

    /**
     * Returns the number of unread notifications (`GET /inbox/count`).
     *
     * @returns An object with a `count` property.
     */
    count(options?: RequestOptions): Promise<{ count: number }>

    /**
     * Marks one or more notifications as read (`POST /inbox/read`).
     *
     * Pass an array of notification IDs, or the string `'all'` to mark
     * everything as read at once.
     *
     * @param ids - An array of notification UUIDs, or `'all'`.
     *
     * @example
     * ```ts
     * await pb.inbox.markRead(['abc', 'def'])
     * await pb.inbox.markRead('all')
     * ```
     */
    markRead(ids: string[] | 'all', options?: RequestOptions): Promise<{ success: boolean; count: number }>

    /**
     * Deletes one or more notifications (`POST /inbox/delete`).
     *
     * @param ids - Notification UUIDs, or `'all'`.
     */
    delete(ids: string[] | 'all', options?: RequestOptions): Promise<{ success: boolean; count: number }>
}

/**
 * Builds the `inbox` resource object used on `PackbaseSDK`.
 *
 * @param http - The shared `HttpClient` instance.
 * @returns An `InboxResource` object with methods for fetching and managing notifications.
 */
export function makeInbox(http: HttpClient): InboxResource {
    return {
        fetch: (options?: FetchInboxOptions): Promise<Paginated<Notification>> =>
            http.get<Paginated<Notification>>('/inbox/fetch', {
                limit: options?.limit,
                cursor: options?.cursor,
                unread_only: options?.unreadOnly,
            }, options),

        count: (options?: RequestOptions): Promise<{ count: number }> =>
            http.get<{ count: number }>('/inbox/count', undefined, options),

        markRead: (ids: string[] | 'all', options?: RequestOptions): Promise<{ success: boolean; count: number }> => {
            if (ids === 'all') {
                return http.post<{ success: boolean; count: number }>('/inbox/read', { all: true }, undefined, options)
            }
            return http.post<{ success: boolean; count: number }>('/inbox/read', { ids }, undefined, options)
        },

        delete: (ids: string[] | 'all', options?: RequestOptions): Promise<{ success: boolean; count: number }> =>
            http.post<{ success: boolean; count: number }>(
                '/inbox/delete',
                ids === 'all' ? {all: true} : {ids},
                undefined,
                options,
            ),
    }
}
