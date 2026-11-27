/** Controls shared behavior for an individual SDK request. */
export interface RequestOptions {
    /** Cancels the request when the signal is aborted. */
    signal?: AbortSignal
}
