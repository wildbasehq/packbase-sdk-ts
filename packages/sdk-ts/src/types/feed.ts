import type { Howl } from './howl'

export interface FeedPage {
    data: Howl[]
    pins: Howl[]
    has_more: boolean
    total_count?: number
}
