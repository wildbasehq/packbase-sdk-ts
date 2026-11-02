import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { Paginated } from '../types/common'
import type { Howl } from '../types/howl'
import type { PackWelcome, PackRulesInput, PackActivityRange, PackInsights, PackPrompt, PackPromptInput, PackPromptList, PackPromptOccurrence, PackPromptPublication, PackRuleReport, PackRuleReportInput, PackRuleReportResult, PackRuleReportPage, PackReportActionInput, PackReportStatus } from '../types/pack-host'

export interface PackHostPageOptions extends RequestOptions { cursor?: string; limit?: number }
export interface PackInsightsOptions extends RequestOptions, PackActivityRange {
    /** IANA timezone for trend bucket boundaries; defaults to UTC. */
    timezone?: string
}
export interface PackUnansweredOptions extends PackHostPageOptions, PackActivityRange {}
export interface PackReportListOptions extends PackHostPageOptions { status?: PackReportStatus }
/** Permission-scoped pack-host tools; constructing this handle makes no request. */
export class PackHostResource {
    constructor(private readonly http: HttpClient, private readonly id: string, private readonly defaults?: RequestOptions) {}
    private path(suffix: string) { return `/pack/${encodeURIComponent(this.id)}/${suffix}` }
    private options(options?: RequestOptions) { return { ...this.defaults, ...options } }
    welcome(options?: RequestOptions): Promise<PackWelcome> { return this.http.get(this.path('welcome'), undefined, this.options(options)) }
    updateWelcome(input: { welcome: string }, options?: RequestOptions): Promise<PackWelcome> { return this.http.put(this.path('welcome'), input, this.options(options)) }
    publishRules(input: PackRulesInput, options?: RequestOptions): Promise<PackWelcome> { return this.http.post(this.path('rules'), input, undefined, this.options(options)) }
    acceptRules(input: { version: number }, options?: RequestOptions): Promise<PackWelcome> { return this.http.post(this.path('rules/accept'), input, undefined, this.options(options)) }
    insights(options?: PackInsightsOptions): Promise<PackInsights> { return this.http.get(this.path('insights'), {from: options?.from, to: options?.to, timezone: options?.timezone}, this.options(options)) }
    unanswered(options?: PackUnansweredOptions): Promise<Paginated<Howl>> { return this.http.get(this.path('unanswered'), {cursor: options?.cursor, limit: options?.limit, from: options?.from, to: options?.to}, this.options(options)) }
    prompts(options?: RequestOptions): Promise<PackPromptList> { return this.http.get(this.path('prompts'), undefined, this.options(options)) }
    createPrompt(input: PackPromptInput, options?: RequestOptions): Promise<PackPrompt> { return this.http.post(this.path('prompts'), input, undefined, this.options(options)) }
    updatePrompt(id: string, input: PackPromptInput, options?: RequestOptions): Promise<PackPrompt> { return this.http.put(this.path(`prompts/${encodeURIComponent(id)}`), input, this.options(options)) }
    deletePrompt(id: string, options?: RequestOptions): Promise<void> { return this.http.delete(this.path(`prompts/${encodeURIComponent(id)}`), undefined, this.options(options)) }
    skipOccurrence(id: string, options?: RequestOptions): Promise<PackPromptOccurrence> { return this.http.post(this.path(`prompt-occurrences/${encodeURIComponent(id)}/skip`), undefined, undefined, this.options(options)) }
    publishOccurrence(id: string, input: PackPromptPublication, options?: RequestOptions): Promise<{ howl: Howl }> { return this.http.post(this.path(`prompt-occurrences/${encodeURIComponent(id)}/publish`), input, undefined, this.options(options)) }
    reports(options?: PackReportListOptions): Promise<PackRuleReportPage> { return this.http.get(this.path('reports'), { status: options?.status, cursor: options?.cursor, limit: options?.limit }, this.options(options)) }
    report(id: string, options?: RequestOptions): Promise<PackRuleReport> { return this.http.get(this.path(`reports/${encodeURIComponent(id)}`), undefined, this.options(options)) }
    submitReport(input: PackRuleReportInput, options?: RequestOptions): Promise<PackRuleReportResult> { return this.http.post(this.path('reports'), input, undefined, this.options(options)) }
    reportAction(id: string, input: PackReportActionInput, options?: RequestOptions): Promise<PackRuleReport> { return this.http.post(this.path(`reports/${encodeURIComponent(id)}/actions`), input, undefined, this.options(options)) }
}
