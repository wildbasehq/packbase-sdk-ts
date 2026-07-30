import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { Pack } from '../types/pack'
import type {
    FriendsResponse,
    Profile,
    StorageUsage,
    UpdateProfileInput,
    UpdateProfileResult,
} from '../types/profile'

/**
 * The type of `pb.me`.
 *
 * Fetches the current user's profile when invoked. Also exposes
 * all `Profile` fields directly (populated after login) so you can read
 * `pb.me.username`, `pb.me.display_name`, etc. without an extra round-trip.
 *
 * @example
 * ```ts
 * const user = await pb.me()
 * console.log(pb.me.username) // populated after SDK is ready
 * await pb.me.update({ display_name: 'New Name' })
 * const settings = await pb.me.settings()
 * await pb.me.settings({ dark_mode: true })
 * ```
 */
export type MeFn = Profile & {
    /**
     * Fetches the authenticated user's full profile (`GET /user/me`).
     *
     * @returns The current user's profile.
     */
    (options?: RequestOptions): Promise<Profile>

    /**
     * Updates the authenticated user's profile (`POST /user/me`).
     *
     * Only the fields you pass are changed. Omitted fields are left as-is.
     *
     * @param data - Partial profile fields to update.
     * @returns The updated profile.
     */
    update(data: UpdateProfileInput, options?: RequestOptions): Promise<UpdateProfileResult>

    /**
     * Fetches all user settings (`GET /user/me/settings`).
     *
     * Settings are returned as a flat key-value map.
     *
     * @returns The current settings object.
     */
    settings(): Promise<Record<string, unknown>>
    settings(data: undefined, options?: RequestOptions): Promise<Record<string, unknown>>

    /**
     * Updates user settings (`POST /user/me/settings`).
     *
     * Merges the supplied key-value pairs into the existing settings.
     * You do not need to send the full settings object.
     *
     * @param data - Key-value pairs to merge into the user's settings.
     * @returns A success flag.
     */
    settings(data: Record<string, unknown>, options?: RequestOptions): Promise<{ success: boolean }>

    /**
     * Fetches the user's friends list (`GET /user/me/friends`).
     *
     * @returns An array of profiles.
     */
    friends(options?: RequestOptions): Promise<FriendsResponse>

    /**
     * Fetches the packs the authenticated user belongs to (`GET /user/me/packs`).
     *
     * @returns An array of packs.
     */
    packs(options?: RequestOptions): Promise<Pack[]>

    /**
     * Selects one of the authenticated user's owned badges.
     *
     * @param badge - Store item ID of the badge to display.
     */
    setBadge(badge: string, options?: RequestOptions): Promise<void>

    /**
     * Fetches the authenticated user's storage quota usage (`GET /user/me/storage`).
     *
     * @returns Storage bytes, file count, and tier.
     */
    storage(options?: RequestOptions): Promise<StorageUsage>
}

/**
 * Builds the `me` callable used on `PackbaseSDK`.
 *
 * The returned function fetches the authenticated user's profile when called,
 * and exposes additional account-level methods on the same callable object.
 * Profile fields are hydrated onto the function object after login via
 * `hydrate()`, so `me.username` etc. are available without an extra fetch.
 *
 * @param http - The shared `HttpClient` instance.
 * @returns A callable function with attached account-level methods and a
 *          `hydrate` helper to populate profile fields.
 */
export function makeMe(http: HttpClient): MeFn & { hydrate(profile: Profile): void } {
    function me(options?: RequestOptions): Promise<Profile> {
        return http.get<Profile>('/user/me', undefined, options)
    }

    me.update = (data: UpdateProfileInput, options?: RequestOptions): Promise<UpdateProfileResult> =>
        http.post<UpdateProfileResult>('/user/me', data, undefined, options)

    /**
     * Fetches or updates the authenticated user's settings.
     *
     * Call without arguments to read the current settings, or pass a partial
     * settings object to merge updates into the existing settings.
     *
     * @param data - Optional settings to merge into the existing settings.
     * @returns The current settings object when called without arguments, or a
     *          success object when called with settings to update.
     */
    me.settings = ((data?: Record<string, unknown>, options?: RequestOptions) => {
        if (data !== undefined) {
            return http.post<{ success: boolean }>('/user/me/settings', data, undefined, options)
        }
        return http.get<Record<string, unknown>>('/user/me/settings', undefined, options)
    }) as MeFn['settings']

    /**
     * Fetches the authenticated user's friends (`GET /user/me/friends`).
     *
     * @returns An array of profiles.
     */
    me.friends = (options?: RequestOptions): Promise<FriendsResponse> =>
        http.get<FriendsResponse>('/user/me/friends', undefined, options)

    /**
     * Fetches the packs the authenticated user belongs to (`GET /user/me/packs`).
     *
     * @returns An array of packs.
     */
    me.packs = (options?: RequestOptions): Promise<Pack[]> =>
        http.get<Pack[]>('/user/me/packs', undefined, options)

    /**
     * Selects the authenticated user's active badge (`POST /user/me/badge`).
     */
    me.setBadge = (badge: string, options?: RequestOptions): Promise<void> =>
        http.post<void>('/user/me/badge', {badge}, undefined, options)

    /**
     * Fetches the authenticated user's storage quota usage (`GET /user/me/storage`).
     *
     * @returns Storage bytes, file count, and tier.
     */
    me.storage = (options?: RequestOptions): Promise<StorageUsage> =>
        http.get<StorageUsage>('/user/me/storage', undefined, options)

    /**
     * Copies all `Profile` fields onto the `me` function object so that
     * `me.username`, `me.display_name`, etc. are directly accessible.
     *
     * Called internally by `PackbaseSDK` once `attemptLogin` succeeds.
     */
    me.hydrate = (profile: Profile): void => {
        Object.assign(me, profile)
    }

    return me as MeFn & { hydrate(profile: Profile): void }
}
