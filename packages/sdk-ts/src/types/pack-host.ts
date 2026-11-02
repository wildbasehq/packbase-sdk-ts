import type { Howl, HowlRating } from './howl'
import type { Paginated } from './common'

export interface PackRule { id: string; title: string; body: string }
export interface PackHostRules { version: number; accepted_version: number; requires_acknowledgment: boolean; eligible: boolean }
export interface PackWelcome {
    welcome: string
    rules_version: number
    rules: PackRule[]
    accepted_version: number
    requires_acknowledgment: boolean
    eligible: boolean
}
export interface PackRulesInput { rules: Array<{ id?: string; title: string; body: string }>; expected_version: number }
export interface PackActivityCounts { members: number; posts: number; replies: number; contributors: number }
/** Counts within one half-open time bucket; contributors are distinct within this bucket. */
export interface PackActivityPoint extends PackActivityCounts {
    /** Inclusive bucket start, clipped to the selected range. */
    from: string
    /** Exclusive bucket end, clipped to the selected range. */
    to: string
}
export interface PackActivityTrend {
    /** Hourly up to 48 hours, daily up to 90 days, otherwise weekly. */
    interval: 'hour' | 'day' | 'week'
    /** IANA timezone used for the bucket boundaries. */
    timezone: string
    /** Chronological buckets, including zero counts for empty intervals. */
    points: PackActivityPoint[]
}
/** Supply both timezone-bearing ISO timestamps, or omit both for the last seven days. */
export interface PackActivityRange {
    /** Inclusive start; the selected range must be no longer than 366 days. */
    from?: string
    /** Exclusive end. */
    to?: string
}
export interface PackInsights {
    current: PackActivityCounts
    previous: PackActivityCounts
    from: string
    to: string
    /** The immediately preceding range of equal elapsed duration. */
    previous_from: string
    previous_to: string
    trend: PackActivityTrend
}
export interface PackPromptInput {
    title: string
    body: string
    tags: string[]
    rating: HowlRating
    /** Selected local weekdays, Sunday = 0. */
    weekdays: number[]
    local_time: string
    timezone: string
    assignee_id: string
    paused: boolean
}
export interface PackPrompt extends PackPromptInput {
    id: string
    pause_reason: string | null
    next_due_at: string
}
export interface PackPromptOccurrence {
    id: string
    prompt_id: string
    due_at: string
    status: 'pending' | 'published' | 'skipped'
    howl_id?: string | null
    prompt: PackPrompt
}
export interface PackPromptList { data: PackPrompt[]; occurrences: PackPromptOccurrence[] }
export interface PackPromptPublication { body: string; tags: string[]; rating: HowlRating }
export type PackReportStatus = 'open' | 'resolved' | 'dismissed' | 'escalated'
export type PackReportAction = 'resolve' | 'dismiss' | 'escalate' | 'delete_howl' | 'kick' | 'ban'
export interface PackReportActionInput { action: PackReportAction; explanation: string }
export interface PackReportHistory { id: string; action: string; explanation: string; created_at: string; actor_id: string }
export interface PackRuleReport {
    id: string
    howl_id: string
    subject_user_id: string
    reporter: { id: string; username: string; display_name?: string | null }
    rule: PackRule
    rules_version: number
    notes: string | null
    status: PackReportStatus
    created_at: string
    actions: PackReportHistory[]
    howl?: Howl | null
}
export interface PackRuleReportInput { howl_id: string; rule_id: string; rules_version: number; notes?: string }
export interface PackRuleReportResult { id: string; status: PackReportStatus }
export type PackRuleReportPage = Paginated<PackRuleReport> & { total_count?: number }
export interface PackPromptReminderMetadata { pack_id: string; prompt_id: string; occurrence_id: string }
export interface PackReportOutcomeMetadata { pack_id: string; report_id: string; status: PackReportStatus }
