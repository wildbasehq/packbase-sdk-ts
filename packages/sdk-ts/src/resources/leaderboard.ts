import type { RequestOptions } from '../cache'
import type { HttpClient } from '../http'
import type { Pack } from '../types/pack'
import type { Profile } from '../types/profile'

export interface PackLeaderboardEntry {
    activity: number
    pack: Pack
}

export interface PackLeaderboard {
    packs: PackLeaderboardEntry[]
}

export interface ProfileLeaderboardEntry {
    xp: number
    since: string
    movement: 'same' | 'gained' | 'lost' | 'new' | string
    delta: number
    profile: Profile
}

export interface ProfileLeaderboard {
    profiles: ProfileLeaderboardEntry[]
    update_in: string
}

/** Pack and profile leaderboard endpoints. */
export interface LeaderboardResource {
    packs(options?: RequestOptions): Promise<PackLeaderboard>
    profiles(options?: RequestOptions): Promise<ProfileLeaderboard>
}

export function makeLeaderboard(http: HttpClient): LeaderboardResource {
    return {
        packs: options => http.get<PackLeaderboard>('/leaderboard/packs', undefined, options),
        profiles: options => http.get<ProfileLeaderboard>('/leaderboard/profiles', undefined, options),
    }
}
