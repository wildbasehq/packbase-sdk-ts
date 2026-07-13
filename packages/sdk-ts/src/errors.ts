/**
 * Error thrown for any non-2xx response from the Packbase API.
 *
 * Server errors are normalized to the shape `{ summary, status, code? }`
 * so callers can branch on the HTTP status and optional machine-readable code
 * without parsing response bodies themselves.
 *
 * Network failures such as DNS errors or timeouts are not wrapped and surface
 * as native `TypeError` instances.
 *
 * @example
 * ```ts
 * try {
 *   await pb.packs('pack-uuid').join()
 * } catch (error) {
 *   if (error instanceof PackbaseError) {
 *     if (error.isConflict) console.log('already a member')
 *     if (error.isUnauthorized) console.log('not logged in')
 *   }
 * }
 * ```
 */
export class PackbaseError extends Error {
    /** HTTP status code returned by the server. */
    readonly status: number

    /** Human-readable error message from the server's `summary` field. */
    readonly summary: string

    /**
     * Machine-readable error code, when provided by the server.
     * Use this to distinguish errors that share the same HTTP status.
     */
    readonly code: string | undefined

    /**
     * Full parsed response body, including any server-specific fields.
     * Useful when debugging or handling custom metadata.
     */
    readonly raw: Record<string, unknown> | undefined

    constructor(
        status: number,
        summary: string,
        code?: string,
        raw?: Record<string, unknown>,
    ) {
        super(summary)
        this.name = 'PackbaseError'
        this.status = status
        this.summary = summary
        this.code = code
        this.raw = raw
    }

    /**
     * `true` when the server returned 401 (no valid session).
     */
    get isUnauthorized() {
        return this.status === 401
    }

    /**
     * `true` when the server returned 403 (authenticated but not allowed).
     */
    get isForbidden() {
        return this.status === 403
    }

    /**
     * `true` when the server returned 404.
     */
    get isNotFound() {
        return this.status === 404
    }

    /**
     * `true` when the server returned 409.
     * Common for duplicate operations, e.g. joining a pack you're already in.
     */
    get isConflict() {
        return this.status === 409
    }

    /**
     * `true` for any 5xx response.
     */
    get isServerError() {
        return this.status >= 500
    }

    /**
     * Creates a `PackbaseError` from a parsed server response body.
     *
     * @param status - The HTTP status code.
     * @param body - The parsed JSON body from the server.
     * @returns A normalized `PackbaseError` instance.
     */
    static fromResponse(status: number, body: Record<string, unknown>): PackbaseError {
        return new PackbaseError(
            status,
            String(body['summary'] ?? 'Unknown error'),
            body['code'] as string | undefined,
            body,
        )
    }
}
