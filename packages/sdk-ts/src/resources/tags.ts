import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'

/** Metadata for a registered howl tag. */
export interface Tag {
    /** Machine-readable tag stored on howls and used in tag URLs. */
    tag: string
    /** Human-readable tag title. */
    title: string
    /** HTML description for the tag. */
    description: string
}

/** Data required to register a howl tag. */
export type CreateTagInput = Tag

/** Metadata changes for a registered tag. At least one field is required. */
export type UpdateTagInput =
    | { title: string; description?: string }
    | { title?: string; description: string }

/** Tag catalog endpoints. */
export type TagsFn = {
    /**
     * Lists the machine-readable names of all registered tags.
     *
     * This callable signature preserves the original `pb.tags()` API.
     */
    (options?: RequestOptions): Promise<string[]>

    /** Fetches metadata for one registered tag. */
    get(tag: string, options?: RequestOptions): Promise<Tag>

    /**
     * Lists the machine-readable tags followed by the authenticated user.
     *
     * Followed tags may be free-form howl tags and do not need to be present
     * in the registered tag catalog.
     */
    following(options?: RequestOptions): Promise<string[]>

    /**
     * Follows a tag for the authenticated user's home and gossip feeds.
     *
     * The tag does not need to be present in the registered tag catalog.
     */
    follow(tag: string, options?: RequestOptions): Promise<void>

    /** Stops following a tag for the authenticated user. */
    unfollow(tag: string, options?: RequestOptions): Promise<void>

    /**
     * Registers a tag.
     *
     * The authenticated user must be Packbase staff or a content moderator.
     */
    create(data: CreateTagInput, options?: RequestOptions): Promise<Tag>

    /**
     * Updates a tag's human-readable metadata.
     *
     * The machine-readable tag identifier is immutable. The authenticated
     * user must be Packbase staff or a content moderator.
     */
    update(tag: string, data: UpdateTagInput, options?: RequestOptions): Promise<Tag>

    /**
     * Deletes a registered tag without removing it from existing howls.
     *
     * The authenticated user must be Packbase staff or a content moderator.
     */
    delete(tag: string, options?: RequestOptions): Promise<void>
}

/** Creates the callable tag catalog resource. */
export function makeTags(http: HttpClient): TagsFn {
    const tags = (options?: RequestOptions) =>
        http.get<string[]>('/tags', undefined, options)

    return Object.assign(tags, {
        get: (tag: string, options?: RequestOptions) =>
            http.get<Tag>(`/tags/${encodeURIComponent(tag)}`, undefined, options),
        following: (options?: RequestOptions) =>
            http.get<string[]>('/user/me/following/tags', undefined, options),
        follow: (tag: string, options?: RequestOptions) =>
            http.post<void>(`/tags/${encodeURIComponent(tag)}/follow`, undefined, undefined, options),
        unfollow: (tag: string, options?: RequestOptions) =>
            http.delete<void>(`/tags/${encodeURIComponent(tag)}/follow`, undefined, options),
        create: (data: CreateTagInput, options?: RequestOptions) =>
            http.post<Tag>('/tags', data, undefined, options),
        update: (tag: string, data: UpdateTagInput, options?: RequestOptions) =>
            http.patch<Tag>(`/tags/${encodeURIComponent(tag)}`, data, options),
        delete: (tag: string, options?: RequestOptions) =>
            http.delete<void>(`/tags/${encodeURIComponent(tag)}`, undefined, options),
    })
}
