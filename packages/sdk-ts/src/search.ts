// ---------------------------------------------------------------------------
// ALLOWED MODELS & FIELDS
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = {
    posts: [
        'id', 'created_at', 'tenant_id', 'content_type', 'body',
        'user_id', 'parent', 'tags', 'assets',
    ],
    profiles: [
        'id', 'created_at', 'username', 'bio', 'slug', 'display_name',
        'images_avatar', 'images_header', 'type', 'space_type', 'is_r18',
    ],
    packs: [
        'id', 'created_at', 'display_name', 'images_avatar',
        'description', 'owner_id', 'images_header', 'last_activity_at',
    ],
} as const

/** A queryable model name (`'posts'`, `'profiles'`, or `'packs'`). */
export type ModelName = keyof typeof ALLOWED_FIELDS

/** A valid field name for the given model. Enforced by TypeScript at the call site. */
export type ModelField<M extends ModelName> = (typeof ALLOWED_FIELDS)[M][number]

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

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
    | Partial<Record<FilterOperator, unknown>>

/** The serialized form of a query, sent as the request body to `POST /search`. */
export interface QueryInput<M extends ModelName = ModelName> {
    from: M
    where?: Record<string, unknown>
    orderBy?: Record<string, SortDirection> | Record<string, SortDirection>[]
    take?: number
    skip?: number
}

/** A map of named queries, sent together in a single `POST /search` request. */
export type NamedQueryMap = Record<string, QueryInput>

/** Maps each `ModelName` to the TypeScript entity type it returns. */
export type ModelResultMap = {
    posts: import('./types/howl').Howl
    profiles: import('./types/profile').Profile
    packs: import('./types/pack').Pack
}

/**
 * Derives a strongly-typed result map from a named query map.
 *
 * Each key in `Q` is mapped to `QueryResult<ModelResultMap[M]>` where `M` is
 * the model used in that query, so callers get e.g. `Pack[] | ErrorEntry`
 * instead of `unknown[] | ErrorEntry`.
 */
export type TypedNamedResultMap<Q extends NamedQueryMap> = {
    [K in keyof Q]: Q[K] extends QueryInput<infer M>
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
export function isErrorEntry(result: QueryResult): result is ErrorEntry {
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
    where(conditions: Partial<Record<ModelField<M>, FilterValue>>): this {
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
    and(conditions: Partial<Record<ModelField<M>, FilterValue>>[]): this {
        this.input.where = {
            ...this.input.where,
            AND: conditions,
        }
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
    or(conditions: Partial<Record<ModelField<M>, FilterValue>>[]): this {
        this.input.where = {
            ...this.input.where,
            OR: conditions,
        }
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
    not(conditions: Partial<Record<ModelField<M>, FilterValue>>): this {
        this.input.where = {
            ...this.input.where,
            NOT: conditions,
        }
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
    orderBy(field: ModelField<M>, direction: SortDirection = 'desc'): this {
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
 * @param model - The model to query (`'posts'`, `'profiles'`, or `'packs'`).
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
