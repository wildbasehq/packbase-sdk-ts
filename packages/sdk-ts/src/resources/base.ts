/**
 * Base class for resource handles that can be awaited directly or used to
 * chain further calls before the request fires.
 *
 * ## How it works
 *
 * Constructing a handle is free, meaning no network request happens until the handle
 * is awaited (or `.then()`/`.catch()`/`.finally()` is called). This lets you
 * build method chains without triggering redundant requests.
 *
 * Chained methods (e.g. `.members()`, `.follow()`) return their own
 * independent handles. They do NOT await the parent first.
 *
 * ```ts
 * const handle = pb.packs('pack-uuid')  // no request
 * await handle                          // GET /pack/pack-uuid
 * await handle.members()                // GET /pack/pack-uuid/members (separate request)
 * ```
 *
 * ## Implementing a resource
 *
 * Extend this class and implement `fetch()`:
 *
 * ```ts
 * class BadgeHandle extends ThenableResource<Badge> {
 *   constructor(private http: HttpClient, private id: string) { super() }
 *
 *   protected fetch(): Promise<Badge> {
 *     return this.http.get<Badge>(`/badges/${this.id}`)
 *   }
 * }
 * ```
 */
export abstract class ThenableResource<T> implements PromiseLike<T> {
    private _promise: Promise<T> | null = null

    /**
     * Fires the underlying HTTP request.
     *
     * This is called at most once. Subsequent awaits reuse the same promise.
     *
     * @returns A promise for the resource value.
     */
    protected abstract fetch(): Promise<T>

    private get promise(): Promise<T> {
        return (this._promise ??= this.fetch())
    }

    /**
     * Attaches fulfillment and rejection handlers.
     *
     * This is invoked automatically by `await` and also triggers the request
     * the first time the handle is consumed.
     *
     * @param onfulfilled - Handler for a fulfilled value.
     * @param onrejected - Handler for a rejected value.
     * @returns A promise for the handler result.
     */
    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected)
    }

    /**
     * Attaches a rejection handler.
     *
     * Equivalent to `.then(undefined, onrejected)`.
     *
     * @param onrejected - Handler for a rejected value.
     * @returns A promise for the handler result.
     */
    catch<TResult = never>(
        onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ): Promise<T | TResult> {
        return this.promise.catch(onrejected)
    }

    /**
     * Attaches a handler that runs regardless of fulfillment or rejection.
     *
     * @param onfinally - Handler that always runs once the promise settles.
     * @returns A promise that resolves with the original value.
     */
    finally(onfinally?: (() => void) | null): Promise<T> {
        return this.promise.finally(onfinally)
    }
}
