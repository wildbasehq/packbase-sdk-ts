import type { HttpClient } from '../http'
import type { RequestOptions } from '../cache'
import type { Profile, ProfileHistoryEntry, ProfileHistoryOptions } from '../types/profile'
import type { ReportReasonValue, ReportResult } from '../types/report'
import { ThenableResource } from './base'

/**
 * A handle for a single user profile. Await it to fetch the profile, or call
 * one of its methods to perform actions on that user.
 *
 * @example
 * ```ts
 * const profile = await pb.profiles('rek')
 * await pb.profiles('rek').follow()
 * const versions = await pb.profiles('rek').history()
 * ```
 */
export class ProfileHandle extends ThenableResource<Profile> {
    constructor(
        private readonly http: HttpClient,
        private readonly username: string,
        private readonly requestOptions?: RequestOptions,
    ) {
        super()
    }

    /** Fetches `GET /user/:username`. */
    protected fetch(): Promise<Profile> {
        return this.http.get<Profile>(`/user/${encodeURIComponent(this.username)}`, undefined, this.requestOptions)
    }

    /**
     * Follows this user (`POST /user/:username/follow`).
     */
    follow(): Promise<void> {
        return this.http.post<void>(`/user/${encodeURIComponent(this.username)}/follow`)
    }

    /**
     * Unfollows this user (`DELETE /user/:username/follow`).
     */
    unfollow(): Promise<void> {
        return this.http.delete<void>(`/user/${encodeURIComponent(this.username)}/follow`)
    }

    /**
     * Fetches the stored version history for this profile.
     */
    history(options: (ProfileHistoryOptions & RequestOptions) = {}): Promise<ProfileHistoryEntry[]> {
        return this.http.get<ProfileHistoryEntry[]>(
            `/user/${encodeURIComponent(this.username)}/history`,
            {
                from: options.from instanceof Date ? options.from.toISOString() : options.from,
                to: options.to instanceof Date ? options.to.toISOString() : options.to,
                axis: options.axis,
                order: options.order,
                limit: options.limit,
            },
            options,
        )
    }

    /**
     * Reports this user for a violation.
     *
     * @param reason - The report category.
     * @param notes - Optional context for the moderation team.
     */
    report(reason: ReportReasonValue, notes?: string): Promise<ReportResult> {
        return this.http.post<ReportResult>(
            `/user/${encodeURIComponent(this.username)}/report`,
            {reason, notes},
        )
    }
}

/**
 * The type of `pb.profiles`.
 *
 * Call it with a username or UUID to get a `ProfileHandle`:
 * ```ts
 * pb.profiles('rek')
 * pb.profiles('some-uuid')
 * ```
 */
export type ProfilesFn = {
    (username: string, options?: RequestOptions): ProfileHandle
}

/**
 * Builds the `profiles` callable used on `PackbaseSDK`.
 *
 * Returns a lazily evaluated function that creates `ProfileHandle` instances
 * for usernames or UUIDs.
 *
 * @param http - The shared `HttpClient` instance.
 * @returns A callable that accepts a username or UUID and returns a `ProfileHandle`.
 *
 * @example
 * ```ts
 * const profiles = makeProfiles(http)
 * await profiles('rek')
 * await profiles('rek').follow()
 * ```
 */
export function makeProfiles(http: HttpClient): ProfilesFn {
    return function profiles(username: string, options?: RequestOptions): ProfileHandle {
        return new ProfileHandle(http, username, options)
    }
}
