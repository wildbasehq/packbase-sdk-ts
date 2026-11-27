import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { Paginated } from '../types/common'

/** Owner-only management record with identity captured when the relation was created. */
export interface ProfileRelationship {
    profile_id: string
    created_at: string
    identity: {
        username: string
        display_name: string | null
    }
}

export type ProfileMute = ProfileRelationship
export type ProfileBlock = ProfileRelationship

export interface ProfileRelationshipListOptions extends RequestOptions {
    cursor?: string
    limit?: number
}

export interface ProfileRelationshipsResource {
    list(options?: ProfileRelationshipListOptions): Promise<Paginated<ProfileRelationship>>
    /** Idempotent. Uses an immutable profile ID. */
    add(profileId: string, options?: RequestOptions): Promise<void>
    /** Removes only the caller's relation, even when the target profile is hidden. */
    remove(profileId: string, options?: RequestOptions): Promise<void>
}

function decodePage(value: unknown): Paginated<ProfileRelationship> {
    if (!value || typeof value !== 'object') throw new TypeError('Invalid profile relationship page.')
    const page = value as Record<string, unknown>
    if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean' ||
        (page.cursor !== undefined && typeof page.cursor !== 'string')) {
        throw new TypeError('Invalid profile relationship page.')
    }
    const data = page.data.map((entry: unknown): ProfileRelationship => {
        if (!entry || typeof entry !== 'object') throw new TypeError('Invalid profile relationship.')
        const record = entry as Record<string, unknown>
        const identity = record.identity as Record<string, unknown> | undefined
        if (typeof record.profile_id !== 'string' || typeof record.created_at !== 'string' ||
            !identity || typeof identity !== 'object' || typeof identity.username !== 'string' ||
            (identity.display_name !== null && typeof identity.display_name !== 'string')) {
            throw new TypeError('Invalid profile relationship.')
        }
        return {
            profile_id: record.profile_id,
            created_at: record.created_at,
            identity: {username: identity.username, display_name: identity.display_name},
        }
    })
    return {data, has_more: page.has_more, ...(page.cursor === undefined ? {} : {cursor: page.cursor})}
}

export function makeProfileRelationships(http: HttpClient, kind: 'mutes' | 'blocks'): ProfileRelationshipsResource {
    const path = `/user/me/${kind}`
    return {
        async list(options = {}) {
            return decodePage(await http.getFresh<unknown>(path, options, {cursor: options.cursor, limit: options.limit}))
        },
        async add(profileId, options) {
            await http.put<void>(`${path}/${encodeURIComponent(profileId)}`, undefined, options)
            http.invalidateVisibility()
        },
        async remove(profileId, options) {
            await http.delete<void>(`${path}/${encodeURIComponent(profileId)}`, undefined, options)
            http.invalidateVisibility()
        },
    }
}
