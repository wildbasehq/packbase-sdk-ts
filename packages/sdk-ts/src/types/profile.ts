import type {Pack} from './pack.ts'

export interface Profile {
    id: string
    username: string
    display_name: string | null
    slug?: string
    badge?: string
    xp?: number
    about?: { bio?: string | null; flair?: string }
    space_type?: 'default' | 'custom_free' | 'custom_unrestricted'
    post_privacy?: 'everyone' | 'followers' | 'friends' | 'private'
    images?: { avatar?: string; header?: string | null }
    following?: boolean
    is_staff?: boolean
    is_content_moderator?: boolean
    is_dx?: boolean
    type?: 'PRIVILEDGED' | 'ALUMNI'
    created_at?: string
    default_pack?: Pack | null
}

export interface UpdateProfileInput {
    display_name?: string
    slug?: string
    about?: { bio?: string }
    space_type?: 'default' | 'custom_free' | 'custom_unrestricted'
    post_privacy?: 'everyone' | 'followers' | 'friends' | 'private'
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
