import type { Howl } from './types/howl'
import type { HowlReadContext } from './resources/visibility'

// ---------------------------------------------------------------------------
// ALLOWED MODELS & FIELDS
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = {
    posts: [
        'id', 'created_at', 'tenant_id', 'content_type', 'body',
        'user_id', 'parent', 'tags', 'assets', 'asset_types',
    ],
    profiles: [
        'id', 'created_at', 'username', 'bio', 'display_name',
        'images_avatar', 'images_header', 'type', 'space_type',
        'profile_avatar_mature', 'profile_banner_mature', 'profile_howls_mature',
    ],
    packs: [
        'id', 'created_at', 'display_name', 'images_avatar',
        'description', 'owner_id', 'images_header', 'last_activity_at',
    ],
    feeds: [
        'id', 'created_at', 'updated_at', 'display_name',
        'description', 'owner_id', 'pin_count', 'system_key', 'default_position',
    ],
} as const

/** A queryable model name (`'posts'`, `'profiles'`, `'packs'`, or `'feeds'`). */
export type ModelName = keyof typeof ALLOWED_FIELDS

/** A valid field name for the given model. Enforced by TypeScript at the call site. */
export type ModelField<M extends ModelName> = (typeof ALLOWED_FIELDS)[M][number]

/**
 * A field `orderBy` accepts: model fields, plus the reader's `pin_position` for pinned feeds
 * and the reader's `network_rank` for posts (their network's ranking, best first; guests and
 * readers with nothing ranked get newest first).
 */
export type ModelOrderField<M extends ModelName> =
    | ModelField<M>
    | (M extends 'feeds' ? 'pin_position' : never)
    | (M extends 'posts' ? 'network_rank' : never)

/** Every search model, in the order editors list them. */
export const SEARCH_MODELS = Object.keys(ALLOWED_FIELDS) as readonly ModelName[]

/** How a field's values compare, which decides the operators that apply to it. */
export type SearchFieldType = 'text' | 'number' | 'boolean' | 'date' | 'id' | 'text[]' | 'json'

/** One field of a search model: whether `where` and `orderBy` accept it. */
export interface SearchField {
    name: string
    type: SearchFieldType
    filter: boolean
    order: boolean
}

// Exhaustive per model, so a field added to ALLOWED_FIELDS fails to compile until it is typed here.
const FIELD_TYPES: { [M in ModelName]: Record<ModelField<M>, SearchFieldType> } = {
    posts: {
        id: 'id', created_at: 'date', tenant_id: 'id', content_type: 'text', body: 'text',
        user_id: 'id', parent: 'id', tags: 'text[]', assets: 'json', asset_types: 'text[]',
    },
    profiles: {
        id: 'id', created_at: 'date', username: 'text', bio: 'text', display_name: 'text',
        images_avatar: 'text', images_header: 'text', type: 'text', space_type: 'text',
        profile_avatar_mature: 'boolean', profile_banner_mature: 'boolean', profile_howls_mature: 'boolean',
    },
    packs: {
        id: 'id', created_at: 'date', display_name: 'text', images_avatar: 'text',
        description: 'text', owner_id: 'id', images_header: 'text', last_activity_at: 'date',
    },
    feeds: {
        id: 'id', created_at: 'date', updated_at: 'date', display_name: 'text',
        description: 'text', owner_id: 'id', pin_count: 'number', system_key: 'text', default_position: 'number',
    },
}

/** Fields that exist only as a filter or only as an ordering, resolved per reader by the server. */
const VIRTUAL_FIELDS: Partial<Record<ModelName, readonly SearchField[]>> = {
    posts: [{ name: 'network_rank', type: 'number', filter: false, order: true }],
    feeds: [
        { name: 'pinned', type: 'boolean', filter: true, order: false },
        { name: 'editable', type: 'boolean', filter: true, order: false },
        { name: 'pin_position', type: 'number', filter: false, order: true },
    ],
}

/** Every field `where` or `orderBy` accepts, per model, with its value type. */
export const SEARCH_FIELDS = Object.fromEntries(
    SEARCH_MODELS.map((model) => [
        model,
        [
            ...ALLOWED_FIELDS[model].map((name): SearchField => ({
                name,
                type: (FIELD_TYPES[model] as Record<string, SearchFieldType>)[name]!,
                filter: true,
                order: true,
            })),
            ...(VIRTUAL_FIELDS[model] ?? []),
        ],
    ]),
) as unknown as { readonly [M in ModelName]: readonly SearchField[] }

// ---------------------------------------------------------------------------
// VIEWER PLACEHOLDERS
// ---------------------------------------------------------------------------

/** Reader-relative values the server resolves per request; the resolved values are never returned. */
export const VIEWER_KEYS = ['id', 'following', 'followers', 'packs', 'followed_tags'] as const

/**
 * A viewer placeholder key. `id` resolves to the reader's profile id (the nil UUID for guests);
 * the others resolve to lists (empty for guests), capped at the 5,000 most recent entries.
 */
export type ViewerKey = (typeof VIEWER_KEYS)[number]

/** `{ $viewer: key }`, allowed wherever a filter value is allowed. */
export interface ViewerPlaceholder<K extends ViewerKey = ViewerKey> {
    $viewer: K
}

/**
 * Returns a placeholder the server replaces with the reader's own data.
 *
 * @example
 * ```ts
 * from('posts').where({ user_id: { in: viewer('following') } })
 * from('feeds').where({ owner_id: viewer('id') })
 * ```
 */
export function viewer<K extends ViewerKey>(key: K): ViewerPlaceholder<K> {
    return { $viewer: key }
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/** Fully hydrated howl returned by post search; no per-post detail fetch is needed. */
export interface SearchPost extends Howl {
    /** Selection provenance for feed:true queries; belongs to this search appearance. */
    feed_explanation?: import('./types/feed-explanation').FeedExplanation
    /** Position in this named query's visible results. */
    __index: number
    user_id?: string
    parent: string | null
}

/** Flat database row returned by searches over `profiles`. */
export interface SearchProfile {
    id: string
    created_at: string
    username: string
    bio: string | null
    display_name: string
    images_avatar: string | null
    images_header: string | null
    type: NonNullable<import('./types/profile').Profile['type']> | null
    space_type: NonNullable<import('./types/profile').Profile['space_type']>
    profile_avatar_mature: boolean
    profile_banner_mature: boolean
    profile_howls_mature: boolean
}

/** Flat database row returned by searches over `packs`. */
export interface SearchPack {
    id: string
    created_at: string
    display_name: string
    images_avatar: string | null
    description: string | null
    owner_id: string | null
    images_header: string | null
    last_activity_at: string | null
}

/** The public profile embedded in feed rows and custom feed runs. */
export interface PublicSearchProfile extends SearchProfile {
    badge?: string
}

/** A custom feed returned by searches over `feeds`: published, or the reader's own draft. */
export interface SearchFeed {
    id: string
    created_at: string
    updated_at: string
    display_name: string
    description: string
    owner_id: string
    pin_count: number
    /** Unlisted feeds appear only in the reader's pins or their own `owner_id` search. */
    listed: boolean
    /** False only for the reader's own drafts, returned when they filter on their own `owner_id`. */
    published: boolean
    /**
     * API path of the published 16:9 cover (1280 x 720 WebP), from `meta.json`'s `cover`, or
     * null. The path carries the revision, so it is safe to cache. Resolve it with `pb.url()`.
     */
    cover: string | null
    /** API path of the published square icon (256 x 256 WebP), from `meta.json`'s `icon`, or null. */
    icon: string | null
    /** `'following'`, `'discover'` or `'everything'` for the built-in feeds, otherwise null. */
    system_key: string | null
    /** Set on feeds pinned for everyone by default (and shown to guests), in tab order. */
    default_position: number | null
    /** Whether the reader may edit and publish the feed's template: its owner, an editor, or staff. */
    can_edit: boolean
    /** Whether the reader has pinned this feed. */
    pinned: boolean
    owner: PublicSearchProfile
}

/** Sort direction for `orderBy`. */
export type SortDirection = 'asc' | 'desc'

/**
 * Prisma-style filter operators supported by the search API.
 *
 * String operators: `contains`, `startsWith`, `endsWith`, `mode`
 * Comparison: `lt`, `lte`, `gt`, `gte`
 * Equality: `equals`, `not`
 * Array: `in`, `notIn`, `has`, `hasSome`, `hasEvery`, `isEmpty`
 */
export type FilterOperator =
    | 'equals' | 'not' | 'in' | 'notIn'
    | 'lt' | 'lte' | 'gt' | 'gte'
    | 'contains' | 'startsWith' | 'endsWith' | 'mode'
    | 'has' | 'hasSome' | 'hasEvery' | 'isEmpty'

/** The operators that apply to each field type. `mode: 'insensitive'` modifies the text operators. */
export const FILTER_OPERATORS: { readonly [T in SearchFieldType]: readonly FilterOperator[] } = {
    text: ['equals', 'not', 'in', 'notIn', 'contains', 'startsWith', 'endsWith', 'mode'],
    id: ['equals', 'not', 'in', 'notIn'],
    number: ['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte'],
    date: ['equals', 'not', 'lt', 'lte', 'gt', 'gte'],
    boolean: ['equals', 'not'],
    'text[]': ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'],
    json: ['equals', 'not'],
}

/**
 * A filter value (scalar or an operator map).
 *
 * @example
 * ```ts
 * // Scalar (shorthand for `{ equals: 'rek' }`)
 * from('profiles').where({ username: 'rek' })
 *
 * // Operator map
 * from('profiles').where({ username: { startsWith: 'r' } })
 * from('packs').where({ created_at: { gte: '2024-01-01' } })
 * ```
 */
export type FilterValue = string | number | boolean | null | string[] | number[]
    | ViewerPlaceholder
    | Partial<Record<FilterOperator, unknown>>

/** Media kinds that can be matched by the posts search index. */
export type PostAssetType = 'image' | 'video'

/** Prisma-style string-list filters supported by the posts `asset_types` index. */
export type PostAssetTypeFilterValue = PostAssetType[] | {
    equals?: PostAssetType[]
    has?: PostAssetType
    hasSome?: PostAssetType[]
    hasEvery?: PostAssetType[]
    isEmpty?: boolean
    not?: PostAssetTypeFilterValue
}

type ModelFilterValue<M extends ModelName, F extends ModelField<M>> =
    M extends 'posts'
    ? F extends 'asset_types'
    ? PostAssetTypeFilterValue
    : FilterValue
    : FilterValue

type FieldFilterConditions<M extends ModelName> = Partial<{
    [F in ModelField<M>]: ModelFilterValue<M, F>
}> & (M extends 'feeds' ? {
    /**
     * `true` keeps the reader's pins (guests get none); `false` excludes them. Reading pins
     * first pins the default feeds once for the reader, so an unpinned default stays unpinned.
     */
    pinned?: boolean
    /** `true` keeps feeds the reader owns or was made an editor of, drafts and unlisted included. */
    editable?: boolean
} : unknown)

/** Type-checked filter conditions for a search model, including logical clauses. */
export type FilterConditions<M extends ModelName> = FieldFilterConditions<M> & {
    AND?: FilterConditions<M>[]
    OR?: FilterConditions<M>[]
    NOT?: FilterConditions<M> | FilterConditions<M>[]
}

/** The serialized form of a query, sent as the request body to `POST /search`. */
export interface QueryInput<M extends ModelName = ModelName> {
    from: M
    /** Apply feed rating preferences and include selection provenance for posts. */
    feed?: boolean
    /** Post mute context; defaults to feed. Blocking is enforced in every context. */
    context?: HowlReadContext
    where?: FilterConditions<M>
    orderBy?: Record<string, SortDirection> | Record<string, SortDirection>[]
    take?: number
    skip?: number
}

/** The `run` named query: renders a whole custom feed in one search key. */
export interface RunFeedQuery {
    run: string
    /** 1-indexed page of the feed's primary query. Defaults to 1. */
    page?: number
    /** Include `presentation` after page 1. */
    presentation?: boolean
    /** Owner-only preview of a validated, possibly unpublished revision. */
    revision?: string
    /**
     * Owner-only live preview of the feed repository's autosaved working copy, by workspace
     * version. The server compiles it on demand without a commit. Excludes `revision`.
     */
    workspace?: string
}

/** A map of named queries, sent together in a single `POST /search` request. */
export type NamedQueryMap = Record<string, QueryInput | RunFeedQuery>

/** Maps each `ModelName` to the TypeScript entity type it returns. */
export type ModelResultMap = {
    posts: SearchPost
    profiles: SearchProfile
    packs: SearchPack
    feeds: SearchFeed
}

/** Any row a search model returns. */
export type SearchRow = ModelResultMap[ModelName]

/**
 * How the feed's owner wants readers to move through its primary results: `infinite` loads
 * more as they scroll, `paged` shows one page at a time. Set by `pagination` in `meta.json`.
 */
export type FeedPagination = 'infinite' | 'paged'

/** The result of a `run` named query. */
export interface CustomFeedRun {
    feed: {
        id: string
        display_name: string
        description: string
        owner: PublicSearchProfile
        pinned: boolean
        pin_count: number
    }
    /** Present on page 1, or when `presentation: true` is passed. */
    presentation?: {
        revision: string
        policy_version: string
        templates: Record<string, string>
        css: string
        packbase_manages_width: boolean
    }
    /** The outputs of the feed's boot script by name; only the primary output is returned after page 1. */
    results: Record<string, QueryResult<SearchRow>>
    /** The name of the feed's primary query in `results`: the one that pages and `has_more` describes. */
    primary: string
    /** The owner's pagination mode, on every page. Feeds compiled before it was added scroll. */
    pagination: FeedPagination
    page: number
    has_more: boolean
}

/**
 * `__error` values a `run` key can return. Hidden, deleted and unpublished feeds are all
 * `not_found`; `invalid` is a malformed id or revision.
 */
export type RunFeedErrorCode = 'not_found' | 'invalid' | 'Query failed'

/**
 * A failed `run` key. A `workspace` preview whose working copy doesn't compile is `invalid`
 * with the compiler's `errors`.
 */
export interface RunFeedError extends ErrorEntry {
    __error: RunFeedErrorCode
    errors?: string[]
}

/**
 * Derives a strongly-typed result map from a named query map.
 *
 * Each key in `Q` is mapped to `QueryResult<ModelResultMap[M]>` where `M` is
 * the model used in that query, so callers get e.g. `Pack[] | ErrorEntry`
 * instead of `unknown[] | ErrorEntry`.
 */
export type TypedNamedResultMap<Q extends NamedQueryMap> = {
    [K in keyof Q]: Q[K] extends RunFeedQuery
    ? CustomFeedRun | ErrorEntry
    : Q[K] extends QueryInput<infer M>
    ? M extends keyof ModelResultMap
    ? QueryResult<ModelResultMap[M]>
    : QueryResult
    : QueryResult
}

/** Returned when the server encounters an error processing a named query. */
export interface ErrorEntry {
    __error: string
}

/**
 * The result of a single named query.
 * Either an array of results or an `ErrorEntry` if the query failed.
 */
export type QueryResult<T = unknown> = T[] | ErrorEntry

/** A map of named query results, keyed by the same names as the input `NamedQueryMap`. */
export type NamedResultMap = Record<string, QueryResult>

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Type guard that returns `true` when a `QueryResult` is an error.
 *
 * @example
 * ```ts
 * const result = await pb.search({ users: from('profiles').where({ username: 'rek' }).build() })
 * if (isErrorEntry(result.users)) {
 *   console.error(result.users.__error)
 * } else {
 *   console.log(result.users) // Profile[]
 * }
 * ```
 */
export function isErrorEntry<T extends object>(result: T | ErrorEntry): result is ErrorEntry {
    return result != null && !Array.isArray(result) && '__error' in result
}

// ---------------------------------------------------------------------------
// QUERY BUILDER
// ---------------------------------------------------------------------------

/**
 * A fluent query builder for the Packbase search API.
 *
 * Build queries with `from()`, chain methods to refine them, then call
 * `.build()` to get the serialized `QueryInput`. Pass that to `pb.search()`.
 *
 * All field names are type-checked against the model's allowed fields, so
 * typos in `.where()` or `.orderBy()` are caught at compile time.
 *
 * @example
 * ```ts
 * const query = from('packs')
 *   .where({ owner_id: 'some-uuid' })
 *   .orderBy('created_at', 'desc')
 *   .take(20)
 *   .build()
 *
 * const result = await pb.search({ myPacks: query })
 * ```
 */
export class SearchQuery<M extends ModelName> {
    private readonly input: QueryInput<M>

    constructor(model: M) {
        this.input = { from: model }
    }

    /** Choose mute behavior for post results. Blocking applies in both contexts. */
    context(context: HowlReadContext): this {
        this.input.context = context
        return this
    }

    /**
     * Adds one or more AND conditions to the query.
     *
     * Multiple calls to `.where()` are merged.
     *
     * @param conditions - A partial map of field names to filter values.
     *
     * @example
     * ```ts
     * from('profiles').where({ username: { startsWith: 'r' } })
     * from('packs').where({ owner_id: 'uuid' }).where({ display_name: { contains: 'art' } })
     * ```
     */
    where(conditions: FilterConditions<M>): this {
        this.input.where = { ...this.input.where, ...conditions }
        return this
    }

    /**
     * Adds an explicit AND clause (Prisma `AND: [...]`).
     *
     * Use when you need to combine multiple conditions that each filter
     * on the same field.
     *
     * @param conditions - Array of condition objects to AND together.
     *
     * @example
     * ```ts
     * from('posts').and([
     *   { created_at: { gte: '2024-01-01' } },
     *   { created_at: { lte: '2024-12-31' } },
     * ])
     * ```
     */
    and(conditions: FilterConditions<M>[]): this {
        this.input.where = {
            ...this.input.where,
            AND: conditions,
        } as FilterConditions<M>
        return this
    }

    /**
     * Adds an OR clause (Prisma `OR: [...]`).
     *
     * Records matching any of the conditions are included.
     *
     * @param conditions - Array of condition objects to OR together.
     *
     * @example
     * ```ts
     * from('profiles').or([
     *   { username: 'alice' },
     *   { username: 'bob' },
     * ])
     * ```
     */
    or(conditions: FilterConditions<M>[]): this {
        this.input.where = {
            ...this.input.where,
            OR: conditions,
        } as FilterConditions<M>
        return this
    }

    /**
     * Excludes records matching the given conditions (Prisma `NOT: {...}`).
     *
     * @param conditions - Conditions to negate.
     *
     * @example
     * ```ts
     * from('profiles').not({ type: 'ALUMNI' })
     * ```
     */
    not(conditions: FilterConditions<M>): this {
        this.input.where = {
            ...this.input.where,
            NOT: conditions,
        } as FilterConditions<M>
        return this
    }

    /**
     * Adds a sort clause.
     *
     * Calling `.orderBy()` multiple times adds additional sort keys. Earlier
     * calls take priority over later ones.
     *
     * @param field - The field to sort by.
     * @param direction - `'asc'` or `'desc'`. Defaults to `'desc'`.
     *
     * @example
     * ```ts
     * from('packs').orderBy('last_activity_at', 'desc').orderBy('display_name', 'asc')
     * ```
     */
    orderBy(field: ModelOrderField<M>, direction: SortDirection = 'desc'): this {
        const existing = this.input.orderBy
        const clause = { [field]: direction } as Record<string, SortDirection>
        if (existing) {
            this.input.orderBy = [
                ...(Array.isArray(existing) ? existing : [existing]),
                clause,
            ]
        } else {
            this.input.orderBy = clause
        }
        return this
    }

    /**
     * Limits the number of results returned.
     *
     * @param count - Maximum number of records to return.
     *
     * @example
     * ```ts
     * from('posts').take(10)
     * ```
     */
    take(count: number): this {
        this.input.take = count
        return this
    }

    /**
     * Skips the first N results.
     *
     * Combine with `.take()` for manual offset pagination.
     * For page-based pagination, prefer `.page()` instead.
     *
     * @param count - Number of records to skip.
     */
    skip(count: number): this {
        this.input.skip = count
        return this
    }

    /**
     * Sets `take` and `skip` for a specific page number.
     *
     * Pages are 1-indexed. `.page(1, 20)` is equivalent to `.take(20).skip(0)`.
     *
     * @param page - 1-indexed page number.
     * @param pageSize - Records per page. Defaults to 50.
     *
     * @example
     * ```ts
     * from('posts').where({ tenant_id: 'pack-id' }).page(2, 25)
     * // returns records 26-50
     * ```
     */
    page(page: number, pageSize = 50): this {
        this.input.take = pageSize
        this.input.skip = (page - 1) * pageSize
        return this
    }

    /**
     * Returns a plain `QueryInput` object that can be passed to `pb.search()`.
     *
     * @example
     * ```ts
     * const q = from('profiles').where({ username: 'rek' }).build()
     * await pb.search({ user: q })
     * ```
     */
    build(): QueryInput<M> {
        return { ...this.input }
    }
}

/**
 * Creates a new `SearchQuery` builder for the given model.
 *
 * This is the entry point for building search queries. Chain methods on the
 * returned builder, then call `.build()` and pass the result to `pb.search()`.
 *
 * @param model - The model to query (`'posts'`, `'profiles'`, `'packs'`, or `'feeds'`).
 * @returns A new `SearchQuery<M>` builder instance.
 *
 * @example
 * ```ts
 * import { PackbaseSDK, from } from '@packbase/sdk-ts'
 *
 * const pb = new PackbaseSDK()
 * const result = await pb.search({
 *   topPacks: from('packs').orderBy('last_activity_at').take(10).build(),
 *   newUsers: from('profiles').orderBy('created_at').take(5).build(),
 * })
 * ```
 */
export function from<M extends ModelName>(model: M): SearchQuery<M> {
    return new SearchQuery(model)
}

/**
 * Builds a `run` named query that renders a custom feed. Pass it as a value to `pb.search()`.
 *
 * @example
 * ```ts
 * const { feed } = await pb.search({ feed: runFeed(feedId, { page: 2 }) })
 * if (!isErrorEntry(feed)) console.log(feed.results.posts, feed.has_more)
 * ```
 */
export function runFeed(
    id: string,
    opts: { page?: number; presentation?: boolean; revision?: string; workspace?: string } = {},
): RunFeedQuery {
    const query: RunFeedQuery = { run: id }
    if (opts.page !== undefined) query.page = opts.page
    if (opts.presentation !== undefined) query.presentation = opts.presentation
    if (opts.revision !== undefined) query.revision = opts.revision
    if (opts.workspace !== undefined) query.workspace = opts.workspace
    return query
}
