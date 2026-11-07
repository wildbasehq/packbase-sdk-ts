import type { Profile } from './profile'
import type { Pack } from './pack'
import type { PackEmote } from './emote'

export type HowlContentType = 'text' | 'howling_alongside' | 'howling_echo'
export type HowlRating = 'rating_safe' | 'rating_mature' | 'rating_suggestive' | 'rating_explicit'

/** Replace a howl's tags and explain the change publicly. */
export interface HowlTagEditInput {
    tags: string[]
    explanation: string
    /** Revision from the latest howl response; stale revisions return 409. */
    expected_revision: number
    /** Staff/content moderators may also replace the protected tag set. */
    moderator_tags?: string[]
}

/** Audited replacement of the protected tag set through the moderator endpoint. */
export interface HowlModeratorTagEditInput {
    tags: string[]
    explanation: string
    expected_revision: number
}

/** Public identity attached to a tag edit, or null when the account is unavailable. */
export type HowlTagEditor = Pick<Profile, 'id' | 'username' | 'display_name' | 'emotes'> & {
    images?: Profile['images']
}

/** Immutable public record of one successful tag or tag-lock change. */
export interface HowlTagHistoryEntry {
    id: string
    revision: number
    created_at: string
    editor: HowlTagEditor | null
    explanation: string
    added_tags: string[]
    removed_tags: string[]
    locked_tags: string[]
    unlocked_tags: string[]
}

/** Authoritative tag state and the public edit created by a successful change. */
export interface HowlTagEditResult {
    tags: string[]
    moderator_tags: string[]
    tag_revision: number
    edit: HowlTagHistoryEntry
}

export interface HowlAsset {
    type: 'image' | 'video' | 'audio' | 'file'
    data: { name?: string; url: string }
}

/** One like per member; emoji is fixed when the howl is created. */
export interface HowlLikes {
    /** Retained custom image for emoji; absent for Unicode emoji. */
    emote?: PackEmote
    emoji: string
    count: number
    likedByMe: boolean
}

/** Authoritative identity and like emoji returned after a reply is created. */
export interface HowlCommentResult {
    id: string
    likes: HowlLikes
}

export interface HowlComment {
    emotes?: PackEmote[]
    moderation_summary?: HowlModerationSummary
    id: string
    body: string
    user: Profile
    created_at: string
    content_type: string
    likes: HowlLikes
    comments?: HowlComment[]
}

export interface Howl {
    /** Resolved images used by this content, independent of the reader's membership. */
    emotes?: PackEmote[]
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
    /** Independent quote reference; does not cascade when its source is deleted. */
    quote_source_id?: string | null
    /** The quoted source is deleted, hidden, or otherwise inaccessible. */
    quote_source_unavailable?: boolean
    parent_post?: unknown
    tenant_id?: string
    content_type: HowlContentType
    created_at: string
    body?: string
    allow_rehowl?: boolean
    rehowled_by?: Profile
    user: Profile
    /** Custom media copyright credit; null uses the creator/year default. */
    copyright?: string | null
    assets?: HowlAsset[]
    moderation_summary?: HowlModerationSummary
    moderator_tags?: string[]
    tags?: string[]
    /** Current tag revision. Fetch again after a 409 before resubmitting an edit. */
    tag_revision?: number
    /** Server-computed capability for this reader; absent on older servers. */
    can_edit_tags?: boolean
    /** Staff/content-moderator capability to change protected tags. */
    can_manage_tag_locks?: boolean
    likes: HowlLikes
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
    /** Source howl to quote; use .comment() for replies. */
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
    error_code?: string
    rules_version?: number
}

/** Job identifier returned when automatic howl polling is disabled. */
export interface HowlCreationJob {
    id: string
}

export interface HowlModerationSummary {
    status: "none" | "under_review" | "reviewed"
    actions: Array<"warning" | "restriction" | "content_removed">
}
