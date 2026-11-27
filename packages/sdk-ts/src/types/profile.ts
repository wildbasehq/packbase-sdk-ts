import type {Pack} from './pack.ts'
import type { PackEmote } from './emote'

export interface Profile {
    /** Resolved images used by this profile, independent of the reader's membership. */
    emotes?: PackEmote[]
    id: string
    username: string
    display_name: string | null
    badge?: string
    about?: { bio?: string | null; flair?: string }
    space_type?: 'default' | 'custom_free' | 'custom_unrestricted'
    profile_avatar_mature?: boolean
    profile_banner_mature?: boolean
    profile_howls_mature?: boolean
    images?: { avatar?: string; header?: string | null }
    following?: boolean
    /** Only whether the authenticated viewer muted this profile. Never incoming state. */
    muted_by_me?: boolean
    is_staff?: boolean
    is_content_moderator?: boolean
    is_dx?: boolean
    type?: 'REGULAR' | 'REGULAR_DX' | 'BOT' | 'BOT_DX' | 'PRIVILEDGED' | 'HYPER_PRIVILEDGED' | 'ALUMNI'
    created_at?: string
    /** Public profiles expose a UUID; the current-user response can expand it. */
    default_pack?: string | Pack | null
}

export interface UpdateProfileInput {
    display_name?: string
    /** Updates the account username through Clerk. */
    username?: string
    about?: { bio?: string }
    space_type?: 'default' | 'custom_free' | 'custom_unrestricted'
    profile_avatar_mature?: boolean
    profile_banner_mature?: boolean
    profile_howls_mature?: boolean
    /** Image fields accept base64 data URLs. */
    images?: { avatar?: string; header?: string }
}

/** The partial profile returned by `POST /user/me`. */
export interface UpdateProfileResult extends Omit<UpdateProfileInput, 'about'> {
    /** The update response returns the saved bio as a flat field. */
    bio?: string
    emotes?: PackEmote[]
    id: string
    username?: string
}

/** Friend data returned by `GET /user/me/friends`. */
export interface FriendProfile {
    id: string
    username: string
    display_name?: string
    images_avatar?: string
    profile_avatar_mature: boolean
    profile_banner_mature: boolean
    profile_howls_mature: boolean
    online?: boolean
    status?: string
}

/** Response from `GET /user/me/friends`. */
export interface FriendsResponse {
    count: number
    friends: FriendProfile[]
    message?: string
}

/** Storage usage returned by `GET /user/me/storage`. */
export interface StorageUsage {
    /** Billable media and complete theme repositories, largest first. Howls are excluded. */
    files: Array<{
        id: string
        name: string
        owner: string
        kind: 'media' | 'video' | 'theme'
        bytes: number
    }>
    /** Charged original media bytes plus complete local theme repositories. */
    totalBytes: number
    allowanceBytes: number
    remainingBytes: number
    overLimit: boolean
    fileCount: number
    /** Physical payload bytes, including originals and delivery copies. */
    localBytes: number
    breakdown: {
        mediaBytes: number
        videoBytes: number
        themeBytes: number
        excludedImageBytes: number
    }
}

/** A former username, recorded when it was replaced. Names may recur. */
export interface UsernameHistoryEntry {
    id: string
    username: string
    changed_at: string
}
