import type { CustomFeedRun, PublicSearchProfile, QueryResult, SearchPack, SearchRow } from './search'

/**
 * The Handlebars helpers templates may use: the built-ins plus the Packbase allowlist.
 * Matches the server's validation list, versioned with the theme policy.
 */
export const TEMPLATE_HELPERS = [
    'if', 'unless', 'each', 'with', 'lookup', 'log',
    'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'and', 'or', 'not',
    'length', 'json', 'date', 'relativeTime', 'number', 'truncate',
    'lower', 'upper', 'plural', 'url', 'asset', 'howlUrl', 'profileUrl',
    'packUrl', 'mediaUrl',
] as const

/** Built-in partials, emitted as `data-pb-slot` markers that the app fills with native components. */
export const BUILTIN_PARTIALS = [
    'howl', 'like', 'replyButton', 'menu', 'share', 'media', 'author',
] as const

export type TemplateHelper = (typeof TEMPLATE_HELPERS)[number]
export type BuiltinPartial = (typeof BUILTIN_PARTIALS)[number]

/** The reader's state as templates see it; viewer identity is deliberately not exposed. */
export interface TemplateViewer {
    signedIn: boolean
}

/** Context a custom feed's templates render with, assembled by the client from a `run` result. */
export interface FeedTemplateContext {
    feed: CustomFeedRun['feed']
    viewer: TemplateViewer
    results: CustomFeedRun['results']
    page: number
    hasMore: boolean
}

/** Context a Handlebars theme page renders with: the page response plus the client's viewer. */
export interface ThemeTemplateContext {
    owner: PublicSearchProfile | SearchPack
    page: string
    results: Record<string, QueryResult<SearchRow>>
    viewer: TemplateViewer
}
