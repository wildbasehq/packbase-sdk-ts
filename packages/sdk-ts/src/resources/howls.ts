import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { Poller, PollOptions } from '../poll'
import type { Howl, HowlCreateInput, HowlCreationJob } from '../types/howl'
import type { JsonObject } from '../types/json'
import type { ReportReasonValue, ReportResult } from '../types/report'
import { ThenableResource } from './base'

/**
 * A handle for a single howl (post). Await it to fetch the howl's data, or
 * call one of its methods to react, comment, delete, etc.
 *
 * @example
 * ```ts
 * const howl = await pb.howls('some-id')
 * await pb.howls('some-id').react('🔥')
 * await pb.howls('some-id').comment('great post')
 * await pb.howls('some-id').delete()
 * ```
 */
export class HowlHandle extends ThenableResource<Howl> {
    constructor(
        private readonly http: HttpClient,
        private readonly id: string,
        private readonly requestOptions?: RequestOptions,
    ) {
        super()
    }

    /**
     * Deletes this howl (`DELETE /howl/:id`).
     *
     * @returns Resolves when the howl has been deleted.
     */
    delete(options?: RequestOptions): Promise<void> {
        return this.http.delete<void>(`/howl/${this.id}`, undefined, options)
    }

    /**
     * Posts a comment on this howl (`POST /howl/:id/comment`).
     *
     * @param body - The comment text.
     * @returns An object containing the new comment's ID.
     */
    comment(body: string, options?: RequestOptions): Promise<{ id: string }> {
        return this.http.post<{ id: string }>(`/howl/${this.id}/comment`, { body }, undefined, options)
    }

    /**
     * Reacts to this howl with an emoji (`POST /howl/:id/react`).
     *
     * @param emoji - The emoji to react with, e.g. `'🔥'`.
     */
    react(emoji: string, options?: RequestOptions): Promise<void> {
        return this.http.post<void>(`/howl/${this.id}/react`, { slot: emoji }, undefined, options)
    }

    /** Removes the caller's reactions from this howl (`DELETE /howl/:id/react`). */
    unreact(options?: RequestOptions): Promise<void> {
        return this.http.delete<void>(`/howl/${this.id}/react`, undefined, options)
    }

    /**
     * Rehowls (reposts) this howl (`POST /howl/:id/rehowl`).
     *
     * @returns An object containing the new rehowl's ID.
     */
    rehowl(options?: RequestOptions): Promise<{ id: string }> {
        return this.http.post<{ id: string }>(`/howl/${this.id}/rehowl`, undefined, undefined, options)
    }

    /**
     * Removes a rehowl of this howl (`DELETE /howl/:id/rehowl`).
     *
     * Resolves when the rehowl has been deleted. Throws if the caller has
     * not previously rehowled this post.
     *
     * @returns Resolves when the rehowl has been removed.
     */
    unrehowl(options?: RequestOptions): Promise<void> {
        return this.http.delete<void>(`/howl/${this.id}/rehowl`, undefined, options)
    }

    /**
     * Reports this howl for a violation (`POST /howl/:id/report`).
     *
     * @param reason - The reason for the report. Use a `ReportReason` value.
     * @param notes - Optional extra context to include with the report.
     * @returns Resolves when the report is submitted.
     *
     * @example
     * ```ts
     * import { ReportReason } from '@packbase/sdk-ts'
     *
     * await pb.howls('howl-id').report(ReportReason.Spam)
     * await pb.howls('howl-id').report(ReportReason.Misinformation, 'Link to source.')
     * ```
     */
    report(reason: ReportReasonValue, notes?: string, options?: RequestOptions): Promise<ReportResult> {
        return this.http.post<ReportResult>(`/howl/${this.id}/report`, { reason, notes }, undefined, options)
    }

    /** Fetches `GET /howl/:id`. */
    protected fetch(): Promise<Howl> {
        return this.http.get<Howl>(`/howl/${this.id}`, undefined, this.requestOptions)
    }
}

/**
 * Options for `pb.howls.create`. Extends `PollOptions` with a `poll` flag.
 */
export interface CreateHowlOptions extends PollOptions {
    /**
     * Whether to poll until the creation job completes before returning.
     *
     * When `true` (default), `create` waits for the background job to finish
     * and returns the completed `Howl`. When `false`, it returns the creation
     * job ID immediately so you can poll manually.
     *
     * @default true
     */
    poll?: boolean
}

export interface HowlUploadInitInput {
    totalBytes: number
    assetType: string
}

export interface HowlUploadAppendInput {
    assetId: string
    segmentIndex: number
    asset: Blob
    fileName?: string
}

export interface HowlUploadResource {
    init(input: HowlUploadInitInput, options?: RequestOptions): Promise<JsonObject>
    append(input: HowlUploadAppendInput, options?: RequestOptions): Promise<JsonObject>
    finalize(assetId: string, options?: RequestOptions): Promise<JsonObject>
    status(assetId: string, options?: RequestOptions): Promise<JsonObject>
}

/**
 * The type of `pb.howls`.
 *
 * Call it with an ID to get a `HowlHandle`, or use `create` to post a new howl:
 *
 * ```ts
 * pb.howls('some-id')                      // returns HowlHandle
 * await pb.howls('some-id').react('🔥')
 * await pb.howls.create({ ... })           // returns Howl (polls until done)
 * ```
 */
export type HowlsFn = {
    (id: string, options?: RequestOptions): HowlHandle
    /**
     * Creates a new howl (`POST /howl/create`).
     *
     * Howl creation is async on the server. By default, `create` polls the job
     * status until it completes and then returns the finished `Howl`. Pass `{ poll: false }` if
     * you want to handle polling yourself.
     *
     * Every howl must include exactly one rating tag (`rating_safe`,
     * `rating_mature`, `rating_suggestive`, or `rating_explicit`).
     *
     * @param data - Howl content and metadata.
     * @param options - Polling behavior and progress callback.
     * @returns The finished `Howl` when `poll: true`, or `{id}` when
     *          `poll: false`.
     *
     * @example
     * ```ts
     * // Wait for the howl to finish (default)
     * const howl = await pb.howls.create({
     *   tenant_id: 'pack-uuid',
     *   body: '<p>Hello world</p>',
     *   tags: ['rating_safe'],
     * })
     *
     * // Fire and poll manually
     * const job = await pb.howls.create({ ... }, { poll: false })
     * // job.id is the howl ID, poll GET /howl/create/status/:id yourself
     * ```
     */
    create(data: HowlCreateInput, options: CreateHowlOptions & {poll: false}): Promise<HowlCreationJob>
    create(data: HowlCreateInput, options?: CreateHowlOptions & {poll?: true}): Promise<Howl>
    create(data: HowlCreateInput, options?: CreateHowlOptions): Promise<Howl | HowlCreationJob>
    /** Multipart howl-asset upload endpoints. */
    upload: HowlUploadResource
}

/**
 * Builds the `howls` callable used on `PackbaseSDK`.
 *
 * @param http - The shared `HttpClient` instance.
 * @param poller - The `Poller` instance used to drive async job polling.
 * @returns A callable that accepts a howl ID and returns a `HowlHandle`,
 *          with `create` attached as a static method.
 */
export function makeHowls(http: HttpClient, poller: Poller): HowlsFn {
    function howls(id: string, options?: RequestOptions): HowlHandle {
        return new HowlHandle(http, id, options)
    }

    howls.create = async (
        data: HowlCreateInput,
        options: CreateHowlOptions = {},
    ): Promise<Howl | HowlCreationJob> => {
        const { poll = true, ...pollOptions } = options
        const runtimeBody = (data as { body: unknown }).body
        const runtimeContentType = (data as { content_type?: unknown }).content_type

        if (runtimeBody !== null && typeof runtimeBody !== 'string') {
            throw new TypeError('Howl body must be a string or null.')
        }
        if (runtimeContentType !== undefined && runtimeContentType !== 'text') {
            throw new TypeError('Howl content_type must be "text" when provided.')
        }

        const { id } = await http.post<{ id: string }>('/howl/create', {
            ...data,
            content_type: 'text',
        }, undefined, {signal: options.signal})

        if (!poll) {
            return {id}
        }

        return poller.waitFor(id, pollOptions)
    }

    const upload: HowlUploadResource = {
        init: (input, requestOptions) => http.post<JsonObject>('/howl/upload/init', {
            command: 'INIT',
            total_bytes: input.totalBytes,
            asset_type: input.assetType,
        }, undefined, requestOptions),
        append: (input, requestOptions) => {
            if (!Number.isInteger(input.segmentIndex) || input.segmentIndex < 0) {
                throw new TypeError('Howl upload segmentIndex must be a non-negative integer.')
            }
            const form = new FormData()
            form.set('command', 'APPEND')
            form.set('asset_id', input.assetId)
            form.set('segment_index', String(input.segmentIndex))
            form.set('asset', input.asset, input.fileName)
            return http.postForm<JsonObject>('/howl/upload/append', form, requestOptions)
        },
        finalize: (assetId, requestOptions) => http.post<JsonObject>('/howl/upload/finalize', {
            command: 'FINALIZE',
            asset_id: assetId,
        }, undefined, requestOptions),
        status: (assetId, requestOptions) => http.get<JsonObject>('/howl/upload/status', {
            asset_id: assetId,
        }, requestOptions),
    }
    Object.assign(howls, {upload})

    return howls as HowlsFn
}
