import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'

export type FeedbackKind = 'idea' | 'problem' | 'other'

export interface FeedbackInput {
    canContact: boolean
    canSendLogs: boolean
    kind: FeedbackKind
    message: string
}

export interface FeedbackResult {
    sent: boolean
}

export interface FeedbackResource {
    /** Sends feedback to the Packbase team for the authenticated user. */
    submit(input: FeedbackInput, options?: RequestOptions): Promise<FeedbackResult>
}

export function makeFeedback(http: HttpClient): FeedbackResource {
    return {
        submit: (input, options) =>
            http.post<FeedbackResult>('/feedback', input, undefined, options),
    }
}
