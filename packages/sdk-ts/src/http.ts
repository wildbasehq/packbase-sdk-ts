import { PackbaseError } from './errors'
import { getCacheStore, type RequestOptions } from './cache'

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

function hashNamespace(value: string): string {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36)
}

/**
 * Configuration passed to `PackbaseSDK` and forwarded to `HttpClient`.
 *
 * This type is shared by the SDK constructor and the low-level HTTP client.
 */
export interface SDKConfig {
    /**
     * Base URL of the Packbase API, without a trailing slash.
     * @example 'https://vgs.packbase.app'
     */
    baseUrl: string

    /**
     * Clerk JWT or API key to send as `Authorization: Bearer <apiKey>`.
     * When omitted, the client falls back to cookie-based auth
     * (`credentials: 'include'`).
     */
    apiKey?: string

    /** Enables response caching for GET requests. Disabled by default. */
    cache?: boolean

    /** Default time-to-live for cached GET responses. @default 300000 */
    cacheTtlMs?: number

    /**
     * Stable cache partition for the authenticated user or session.
     * Supplying this is recommended when browser storage is shared by users.
     */
    cacheNamespace?: string

}

/**
 * Low-level HTTP client used by all SDK resources.
 *
 * All request methods throw `PackbaseError` for non-2xx responses. Network
 * failures propagate as native `TypeError`.
 *
 * Do not use this directly, please interact with the API through the resource methods
 * on `PackbaseSDK` instead.
 */
export class HttpClient {
    private readonly baseUrl: string
    private readonly apiKey: string | undefined
    private readonly cacheEnabled: boolean
    private readonly cacheNamespace: string
    private readonly cacheTtlMs: number
    private readonly pendingReads = new Map<string, Promise<unknown>>()
    private cacheGeneration = 0

    /**
     * Creates a new HTTP client instance.
     *
     * @param config - Base URL and optional API key used for all requests.
     */
    constructor(config: SDKConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '')
        this.apiKey = config.apiKey
        this.cacheEnabled = config.cache ?? false
        this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
        const partition = config.cacheNamespace
            ?? hashNamespace(config.apiKey ?? 'cookie-session')
        this.cacheNamespace = `${this.baseUrl}:${partition}`
    }

    /**
     * Returns the auth headers to include on every request.
     *
     * When `apiKey` is set, sends `Authorization: Bearer <apiKey>`.
     * Otherwise returns an empty object and lets cookies handle auth.
     *
     * @returns Request headers containing authorization when configured.
     */
    private authHeaders(): Record<string, string> {
        if (this.apiKey) {
            return { 'Authorization': `Bearer ${this.apiKey}` }
        }
        return {}
    }

    /**
     * Builds a fully-qualified URL from a path and an optional query params object.
     * `null` and `undefined` values are omitted from the query string.
     *
     * @param path - The API path, e.g. `/user/me`.
     * @param query - Key-value pairs to append as query parameters.
     * @returns A fully-qualified URL string.
     */
    private buildUrl(path: string, query?: Record<string, unknown>): string {
        const url = new URL(path, this.baseUrl + '/')
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value))
                }
            }
        }
        return url.toString()
    }

    /**
     * Reads a response. Returns the parsed JSON body on success.
     * Throws `PackbaseError` for any non-2xx status.
     * Returns `undefined` for 204 No Content responses.
     *
     * @param res - The raw `Response` from `fetch`.
     */
    private async handleResponse<T>(res: Response): Promise<T> {
        if (res.ok) {
            if (res.status === 204) return undefined as T
            return res.json() as Promise<T>
        }

        let body: Record<string, unknown> = {}
        try {
            body = await res.json() as Record<string, unknown>
        } catch {
            // Body may not be JSON for certain error responses.
        }

        throw PackbaseError.fromResponse(res.status, body)
    }

    /**
     * Sends a GET request.
     *
     * @param path - API path, e.g. `/pack/pack-uuid`.
     * @param query - Optional query parameters.
     * @returns The parsed response body.
     *
     * @example
     * ```ts
     * const pack = await http.get<Pack>('/pack/pack-uuid')
     * const members = await http.get('/pack/pack-uuid/members', { limit: 20 })
     * ```
     */
    async get<T>(
        path: string,
        query?: Record<string, unknown>,
        options: RequestOptions = {},
    ): Promise<T> {
        this.throwIfAborted(options.signal)
        const url = this.buildUrl(path, query)
        const shouldCache = options.cache ?? this.cacheEnabled

        if (!shouldCache) return this.fetchGet<T>(url, options)

        const key = `${this.cacheNamespace}:${url}`
        const store = getCacheStore()
        const cached = await store.get(key)
        if (cached && cached.expiresAt > Date.now()) return cached.value as T
        if (cached) {
            await store.delete(key)
        }

        const pending = options.signal ? undefined : this.pendingReads.get(key)
        if (pending) return pending as Promise<T>

        const generation = this.cacheGeneration
        const request = this.fetchGet<T>(url, options).then(async value => {
            this.throwIfAborted(options.signal)
            const ttl = options.cacheTtlMs ?? this.cacheTtlMs
            if (ttl > 0 && generation === this.cacheGeneration) {
                await store.set(key, {value, expiresAt: Date.now() + ttl})
            }
            return value
        }).finally(() => {
            if (this.pendingReads.get(key) === request) {
                this.pendingReads.delete(key)
            }
        })

        if (!options.signal) this.pendingReads.set(key, request)
        return request
    }

    /** @internal Performs a side-effecting legacy GET and invalidates cached reads. */
    async getMutation<T>(
        path: string,
        query?: Record<string, unknown>,
        options: RequestOptions = {},
    ): Promise<T> {
        const value = await this.fetchGet<T>(this.buildUrl(path, query), options)
        await this.invalidateCache()
        return value
    }

    /**
     * Sends a POST request with a JSON body.
     *
     * @param path - API path, e.g. `/pack/create`.
     * @param body - Data to JSON-serialize as the request body. Omit for bodyless POSTs.
     * @param query - Optional query parameters.
     * @returns The parsed response body.
     *
     * @example
     * ```ts
     * const pack = await http.post<Pack>('/pack/create', { display_name: 'My Pack', description: '...' })
     * ```
     */
    async post<T>(
        path: string,
        body?: unknown,
        query?: Record<string, unknown>,
        options: RequestOptions = {},
    ): Promise<T> {
        this.throwIfAborted(options.signal)
        const res = await fetch(this.buildUrl(path, query), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
            },
            credentials: this.apiKey ? 'omit' : 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: options.signal,
        })
        const value = await this.handleResponse<T>(res)
        await this.invalidateCache()
        return value
    }

    /**
     * Sends a PATCH request with a JSON body.
     *
     * @param path - API path.
     * @param body - Data to JSON-serialize as the request body.
     * @returns The parsed response body.
     */
    async patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        this.throwIfAborted(options.signal)
        const res = await fetch(this.buildUrl(path), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
            },
            credentials: this.apiKey ? 'omit' : 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: options.signal,
        })
        const value = await this.handleResponse<T>(res)
        await this.invalidateCache()
        return value
    }

    /**
     * Sends a PUT request with a JSON body.
     *
     * @param path - API path.
     * @param body - Data to JSON-serialize as the request body.
     * @returns The parsed response body.
     */
    async put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        this.throwIfAborted(options.signal)
        const res = await fetch(this.buildUrl(path), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
            },
            credentials: this.apiKey ? 'omit' : 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: options.signal,
        })
        const value = await this.handleResponse<T>(res)
        await this.invalidateCache()
        return value
    }

    /**
     * Sends a DELETE request, optionally with a JSON body.
     *
     * @param path - API path, e.g. `/folder/some-id`.
     * @param body - Optional body for DELETE requests that accept one (e.g. batch deletes).
     * @returns The parsed response body.
     *
     * @example
     * ```ts
     * await http.delete('/folder/some-id')
     * ```
     */
    async delete<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        this.throwIfAborted(options.signal)
        const res = await fetch(this.buildUrl(path), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
            },
            credentials: this.apiKey ? 'omit' : 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: options.signal,
        })
        const value = await this.handleResponse<T>(res)
        await this.invalidateCache()
        return value
    }

    /** Sends a multipart POST without setting Content-Type, allowing fetch to add the boundary. */
    async postForm<T>(path: string, body: FormData, options: RequestOptions = {}): Promise<T> {
        this.throwIfAborted(options.signal)
        const res = await fetch(this.buildUrl(path), {
            method: 'POST',
            headers: this.authHeaders(),
            credentials: this.apiKey ? 'omit' : 'include',
            body,
            signal: options.signal,
        })
        const value = await this.handleResponse<T>(res)
        await this.invalidateCache()
        return value
    }

    private async fetchGet<T>(url: string, options: RequestOptions = {}): Promise<T> {
        this.throwIfAborted(options.signal)
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...this.authHeaders(),
            },
            credentials: this.apiKey ? 'omit' : 'include',
            signal: options.signal,
        })
        return this.handleResponse<T>(res)
    }

    private throwIfAborted(signal?: AbortSignal): void {
        if (!signal?.aborted) return
        if (typeof signal.throwIfAborted === 'function') signal.throwIfAborted()
        throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
    }

    private async invalidateCache(): Promise<void> {
        this.cacheGeneration += 1
        this.pendingReads.clear()
        await getCacheStore().clear(this.cacheNamespace)
    }
}
