import type { Howl } from './howl'
import type { FeedExplanation } from './feed-explanation'

export interface FeedPage {
    /** Per-response provenance keyed by concrete howl ID, never canonical ID. */
    explanations?: Record<string, FeedExplanation>
    data: Howl[]
    pins: Howl[]
    has_more: boolean
    total_count?: number
}
