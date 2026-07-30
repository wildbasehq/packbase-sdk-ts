/** Minimal browser-compatible typed event emitter (replaces node:events). */
class EventEmitter<TMap extends { [K in keyof TMap]: unknown[] }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly _listeners = new Map<keyof TMap, ((...args: any[]) => void)[]>()

    on<K extends keyof TMap>(event: K, listener: (...args: TMap[K]) => void): this {
        const bucket = this._listeners.get(event) ?? []
        bucket.push(listener)
        this._listeners.set(event, bucket)
        return this
    }

    off<K extends keyof TMap>(event: K, listener: (...args: TMap[K]) => void): this {
        const bucket = this._listeners.get(event)
        if (!bucket) return this
        const index = bucket.indexOf(listener)
        if (index !== -1) bucket.splice(index, 1)
        if (bucket.length === 0) this._listeners.delete(event)
        return this
    }

    emit<K extends keyof TMap>(event: K, ...args: TMap[K]): void {
        this._listeners.get(event)?.forEach(fn => fn(...args))
    }
}
import { PackbaseError } from './errors'
import { HttpClient, type SDKConfig } from './http'
import type { RequestOptions } from './request'
import { Poller } from './poll'
import { type FeedsFn, makeFeeds } from './resources/feeds'
import { type HowlsFn, makeHowls } from './resources/howls'
import { type InboxResource, makeInbox } from './resources/inbox'
import { type InvitesResource, makeInvites } from './resources/invites'
import { type FoldersResource, makeFolders } from './resources/folders'
import { type LeaderboardResource, makeLeaderboard } from './resources/leaderboard'
import { makeMe, type MeFn } from './resources/me'
import { makePacks, type PacksFn } from './resources/packs'
import { makeProfiles, type ProfilesFn } from './resources/profiles'
import { type StoreResource, makeStore } from './resources/store'
import type { NamedQueryMap, TypedNamedResultMap } from './search'
import type { Profile } from './types/profile'

/**
 * Configuration for `PackbaseSDK`.
 *
 * This is the public constructor config for the high-level SDK.
 */
export interface PackbaseSDKConfig extends Partial<SDKConfig> {
    /**
     * Base URL of the Packbase API, without a trailing slash.
     *
     * @default 'https://vgs.packbase.app'
     */
    baseUrl?: string

    /**
     * Whether construction should automatically fetch and hydrate `me`.
     * Disable this for anonymous, public-only clients.
     * @default true
     */
    autoLogin?: boolean
}

/**
 * Event map for {@link PackbaseSDK}.
 *
 * @example
 * ```ts
 * pb.on('ready', (profile) => console.log('Logged in as', profile.username))
 * ```
 */
export interface PackbaseSDKEvents {
    /**
     * Emitted once the SDK has successfully authenticated and the `me` object
     * has been populated with the current user's profile.
     *
     * @param profile - The authenticated user's profile.
     */
    ready: [profile: Profile]
    /**
     * Emitted when the initial authentication attempt fails.
     *
     * @param error - The error that caused login to fail.
     */
    error: [error: unknown]
}

/**
 * The Packbase SDK client. Create one instance and reuse it across your app.
 *
 * ## Auth
 *
 * Pass `apiKey` to use a Clerk JWT or API key:
 * ```ts
 * const pb = new PackbaseSDK({ apiKey: 'your-clerk-jwt' })
 * ```
 *
 * Omit it to fall back to cookie-based auth (useful in browser contexts where
 * the session cookie is set by the server):
 * ```ts
 * const pb = new PackbaseSDK()
 * ```
 *
 * ## Usage
 *
 * ```ts
 * // Profiles
 * const profile = await pb.profiles('rek')
 * await pb.profiles('rek').follow()
 *
 * // Current user
 * const me = await pb.me()
 * await pb.me.update({ display_name: 'New Name' })
 * console.log(pb.me.username) // available after 'ready' event
 *
 * // Packs
 * const pack = await pb.packs('pack-uuid')
 * await pb.packs('pack-uuid').join()
 * const all = await pb.packs.list()
 *
 * // Howls
 * const howl = await pb.howls.create({
 *   tenant_id: 'pack-uuid',
 *   body: '<p>Hello</p>',
 *   tags: ['rating_safe'],
 * })
 * await pb.howls('howl-id').react('🔥')
 *
 * // Inbox
 * const { data } = await pb.inbox.fetch({ unreadOnly: true })
 * await pb.inbox.markRead('all')
 *
 * // Search
 * import { from } from '@packbase/sdk-ts'
 * const results = await pb.search({
 *   packs: from('packs').orderBy('last_activity_at').take(10).build(),
 * })
 *
 * // Events
 * pb.on('ready', (profile) => console.log('Logged in as', profile.username))
 * pb.on('error', (err) => console.error('Auth failed', err))
 * ```
 */
export class PackbaseSDK {
    /**
     * Profile resource. Call with a username or UUID to get a `ProfileHandle`,
     * or call methods on the handle to follow, report, etc.
     *
     * @example
     * ```ts
     * await pb.profiles('rek')
     * await pb.profiles('rek').follow()
     * await pb.profiles('rek').history()
     * ```
     */
    readonly profiles: ProfilesFn
    /**
     * Current user resource. Call to fetch your profile, or use the attached
     * methods for account-level operations.
     *
     * @example
     * ```ts
     * await pb.me()
     * await pb.me.update({ bio: 'hello' })
     * await pb.me.settings()
     * await pb.me.settings({ dark_mode: true })
     * await pb.me.packs()
     * ```
     */
    readonly me: MeFn
    /**
     * Pack resource. Call with a UUID to get a `PackHandle`, or use
     * `list`/`create` to work with packs in bulk.
     *
     * @example
     * ```ts
     * await pb.packs('pack-uuid')
     * await pb.packs('pack-uuid').join()
     * await pb.packs('pack-uuid').members()
     * await pb.packs.list()
     * await pb.packs.create({ display_name: 'Art Pack', description: '...' })
     * ```
     */
    readonly packs: PacksFn
    /**
     * Howl (post) resource. Call with an ID to get a `HowlHandle`, or use
     * `create` to post a new howl.
     *
     * Howl creation is async on the server. By default, `create` polls until
     * the job completes and returns the finished howl.
     *
     * @example
     * ```ts
     * await pb.howls('id')
     * await pb.howls('id').react('🔥')
     * await pb.howls('id').rehowl()
     * await pb.howls.create({ tenant_id: 'pack-id', body: 'hi', tags: ['rating_safe'] })
     * ```
     */
    readonly howls: HowlsFn
    /**
     * Feed resource. Call with a feed ID to fetch paginated feed data,
     * including any pinned howls for that feed.
     *
     * @example
     * ```ts
     * const page = await pb.feeds('universe:home').fetch({ page: 2 })
     * console.log(page.pins)
     * ```
     */
    readonly feeds: FeedsFn

    /**
     * Inbox (notifications) resource.
     *
     * @example
     * ```ts
     * const { data, has_more } = await pb.inbox.fetch({ unreadOnly: true })
     * const { count } = await pb.inbox.count()
     * await pb.inbox.markRead(['id1', 'id2'])
     * await pb.inbox.markRead('all')
     * ```
     */
    readonly inbox: InboxResource
    /**
     * Leaderboard endpoints.
     *
     * @example
     * ```ts
     * await pb.leaderboard.packs()
     * await pb.leaderboard.profiles()
     * ```
     */
    readonly leaderboard: LeaderboardResource
    /**
     * Store endpoints.
     *
     * @example
     * ```ts
     * await pb.store.list()
     * await pb.store.catalog()
     * await pb.store.purchase('item-id')
     * ```
     */
    readonly store: StoreResource
    /**
     * Invite endpoints.
     *
     * @example
     * ```ts
     * await pb.invites.list()
     * const invite = await pb.invites.generate('person@example.com')
     * ```
     */
    readonly invites: InvitesResource
    /**
     * Folder endpoints.
     *
     * @example
     * ```ts
     * await pb.folders.list('user-id')
     * await pb.folders.get('folder-id')
     * ```
     */
    readonly folders: FoldersResource
    private readonly http: HttpClient
    private readonly _events: EventEmitter<PackbaseSDKEvents>

    constructor(config: PackbaseSDKConfig = {}) {
        this.http = new HttpClient({
            baseUrl: config.baseUrl ?? 'https://vgs.packbase.app',
            apiKey: config.apiKey,
        })

        this._events = new EventEmitter<PackbaseSDKEvents>()

        const poller = new Poller(this.http)

        this.me = makeMe(this.http)
        this.profiles = makeProfiles(this.http)
        this.packs = makePacks(this.http)
        this.howls = makeHowls(this.http, poller)
        this.feeds = makeFeeds(this.http)
        this.inbox = makeInbox(this.http)

        this.leaderboard = makeLeaderboard(this.http)
        this.store = makeStore(this.http)
        this.invites = makeInvites(this.http)
        this.folders = makeFolders(this.http)

        if (config.autoLogin ?? true) {
            void this.attemptLogin()
        }
    }

    /**
     * Registers a listener for a SDK lifecycle event.
     *
     * | Event | When |
     * |-------|------|
     * | `ready` | The SDK authenticated successfully; `me` is fully populated. |
     * | `error` | The initial authentication attempt failed. |
     *
     * @param event - The event name.
     * @param listener - The callback to invoke.
     * @returns `this` for chaining.
     *
     * @example
     * ```ts
     * pb.on('ready', (profile) => console.log('Hello', profile.username))
     * pb.on('error', (err) => console.error('Auth error', err))
     * ```
     */
    on<K extends keyof PackbaseSDKEvents>(
        event: K,
        listener: (...args: PackbaseSDKEvents[K]) => void,
    ): this {
        this._events.on(event, listener)
        return this
    }

    /** Removes a previously registered SDK lifecycle listener. */
    off<K extends keyof PackbaseSDKEvents>(
        event: K,
        listener: (...args: PackbaseSDKEvents[K]) => void,
    ): this {
        this._events.off(event, listener)
        return this
    }

    /**
     * Fetches all available tags (`GET /tags`).
     *
     * @returns An array of tag strings.
     *
     * @example
     * ```ts
     * const tags = await pb.tags()
     * ```
     */
    tags(options?: RequestOptions): Promise<string[]> {
        return this.http.get<string[]>('/tags', undefined, options)
    }

    /**
     * Executes one or more named search queries in a single request (`POST /search`).
     *
     * Use the `from()` builder to construct queries. Results are keyed by the
     * same names you pass in.
     *
     * Check each result with `isErrorEntry()` before using it!! the server can
     * return a per-query error without failing the whole request.
     *
     * @param queries - A map of query names to `QueryInput` objects.
     * @param options
     * @returns A map of query names to their results.
     *
     * @example
     * ```ts
     * import { PackbaseSDK, from, isErrorEntry } from '@packbase/sdk-ts'
     *
     * const pb = new PackbaseSDK()
     * const { topPacks, recentUsers } = await pb.search({
     *   topPacks: from('packs').orderBy('last_activity_at').take(10).build(),
     *   recentUsers: from('profiles').orderBy('created_at').take(5).build(),
     * })
     *
     * if (!isErrorEntry(topPacks)) {
     *   console.log(topPacks) // Pack[]
     * }
     * ```
     */
    search<Q extends NamedQueryMap>(
        queries: Q,
        options?: RequestOptions,
    ): Promise<TypedNamedResultMap<Q>> {
        return this.http.post<TypedNamedResultMap<Q>>('/search', queries, undefined, options)
    }

    /** @internal Emits a typed SDK event. Not exposed on the public API. */
    private emit<K extends keyof PackbaseSDKEvents>(
        event: K,
        ...args: PackbaseSDKEvents[K]
    ): void {
        this._events.emit(event, ...args)
    }

    private async attemptLogin() {
        try {
            const profile = await this.me()
            const me = this.me as MeFn & {hydrate(profile: Profile): void}
            me.hydrate(profile)
            this.emit('ready', profile)
        } catch (error) {
            if (error instanceof PackbaseError) {
                console.error('Failed to login to Packbase:', error.message)
            } else {
                console.error('Unexpected error:', error)
            }
            this.emit('error', error)
        }
    }
}
