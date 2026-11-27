/**
 * The allowed reason values when submitting a report.
 *
 * Use these values as the `reason` argument to `.report()` on a howl or pack.
 *
 * @example
 * ```ts
 * import { ReportReason } from '@packbase/sdk-ts'
 *
 * await pb.howls('howl-id').report(ReportReason.Spam)
 * await pb.packs('pack-id').report(ReportReason.HarassmentOrBullying, 'Extra context here.')
 * ```
 */
export const ReportReason = {
    Spam: 'Spam',
    HarassmentOrBullying: 'Harassment or bullying',
    HateSpeechOrDiscrimination: 'Hate speech or discrimination',
    Misinformation: 'Misinformation',
    SexualContent: 'Sexual content',
    ViolenceOrThreats: 'Violence or threats',
    SelfHarm: 'Self-harm',
    Other: 'Other',
} as const

/** A valid report reason string. Derived from `ReportReason`. */
export type ReportReasonValue = (typeof ReportReason)[keyof typeof ReportReason]

/** Ticket created for a submitted report. */
export interface ReportResult {
    id: string
    status: string
}
