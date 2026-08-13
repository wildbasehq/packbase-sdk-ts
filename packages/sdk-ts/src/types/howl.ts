import type { Profile } from './profile'
import type { Pack } from './pack'

export type HowlContentType = 'text' | 'howling_alongside' | 'howling_echo'
export type HowlRating = 'rating_safe' | 'rating_mature' | 'rating_suggestive' | 'rating_explicit'

export interface HowlAsset {
    type: 'image' | 'video' | 'audio' | 'file'
    data: { name?: string; url: string }
}

export interface HowlReaction {
    key: string
    emoji: string
    count: number
    reactedByMe?: boolean
}

export interface HowlComment {
    id: string
    body: string
    user: Profile
    created_at: string
    content_type: string
    reactions?: HowlReaction[]
    comments?: HowlComment[]
}

export interface Howl {
    /** ID of this concrete howl record, including a rehowl or quote rehowl. */
    id: string
    /**
     * Legacy rehowl-record ID returned by older API payloads.
     *
     * @deprecated Use `id`, which always identifies the concrete howl record.
     */
    rehowl_id?: string
    /** ID of the canonical/original howl used as the interaction target. */
    canonical_id?: string
    parent_post?: unknown
    tenant_id?: string
    content_type: HowlContentType
    created_at: string
    body?: string
    allow_rehowl?: boolean
    rehowled_by?: Profile
    user: Profile
    assets?: HowlAsset[]
    tags?: string[]
    reactions?: HowlReaction[]
    comments?: HowlComment[]
    pack?: Pack
    warning?: { reason: string } | null
    meta?: {
        rehowled: boolean
        pinned?: boolean
        pin_expires_at?: string
        folder_count?: number
    }
}

export interface HowlCreateInput {
    tenant_id: string
    parent_id?: string
    content_type?: 'text'
    body: string | null
    asset_ids?: string[]
    tags: [string, ...string[]]
}

export interface HowlJobStatus {
    id: string
    status: 'pending' | 'uploading' | 'converting' | 'processing' | 'completed' | 'failed'
    progress: { currentAsset: number; totalAssets: number; currentAssetProgress?: number }
    createdAt: number
    updatedAt: number
    error?: string
}

/** Job identifier returned when automatic howl polling is disabled. */
export interface HowlCreationJob {
    id: string
}
