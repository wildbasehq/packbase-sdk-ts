import type {Pack} from './pack.ts'

export interface Profile {
    id: string
    username: string
    display_name: string | null
    badge?: string
    xp?: number
    about?: { bio?: string | null; flair?: string }
    space_type?: 'default' | 'custom_free' | 'custom_unrestricted'
    post_privacy?: 'everyone' | 'followers' | 'friends' | 'private'
    is_r18?: boolean
    /** Whether active Suggestive or Explicit howls lock the mature profile switch (self only). */
    has_r18_howls?: boolean
    images?: { avatar?: string; header?: string | null }
    following?: boolean
    /** Only whether the authenticated viewer muted this profile. Never incoming state. */
    muted_by_me?: boolean
    is_staff?: boolean
    is_content_moderator?: boolean
    is_dx?: boolean
    type?: 'PRIVILEDGED' | 'ALUMNI'
    created_at?: string
    default_pack?: Pack | null
}

export interface UpdateProfileInput {
    display_name?: string
    /** Updates the account username through Clerk. */
    username?: string
    about?: { bio?: string }
    space_type?: 'default' | 'custom_free' | 'custom_unrestricted'
    post_privacy?: 'everyone' | 'followers' | 'friends' | 'private'
    is_r18?: boolean
    /** Image fields accept base64 data URLs. */
    images?: { avatar?: string; header?: string }
}

/** The partial profile returned by `POST /user/me`. */
export interface UpdateProfileResult extends UpdateProfileInput {
    id: string
    username?: string
}

/** Friend data returned by `GET /user/me/friends`. */
export interface FriendProfile {
    id: string
    username: string
    display_name?: string
    images_avatar?: string
    is_r18: boolean
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
    totalBytes: number
    fileCount?: number
    tier?: string
    error?: string
}

/** A former username, recorded when it was replaced. Names may recur. */
export interface UsernameHistoryEntry {
    id: string
    username: string
    changed_at: string
}
