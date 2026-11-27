import type { RenderedTemplateTheme } from './resources/themes'
import type { CustomFeedRun, PublicSearchProfile, SearchPack } from './search'

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

/**
 * What a custom feed's templates render with: every output of the feed's boot script under
 * its own name (an output `posts` is `{{posts}}`), beside what a feed always gives.
 */
export type FeedTemplateContext = Record<string, unknown> & {
    feed: CustomFeedRun['feed']
    viewer: TemplateViewer
    page: number
    hasMore: boolean
}

/** What a Handlebars theme page renders with: its boot script's outputs, beside what a page always gives. */
export type ThemeTemplateContext = Record<string, unknown> & {
    owner: PublicSearchProfile | SearchPack
    page: string
    viewer: TemplateViewer
}

/** Builds a feed's template context from a `run` result. What a feed always gives is never replaced by an output. */
export function feedTemplateContext(run: CustomFeedRun, viewer: TemplateViewer): FeedTemplateContext {
    return { ...run.results, feed: run.feed, viewer, page: run.page, hasMore: run.has_more }
}

/** Builds a theme page's template context from its rendered response. */
export function themeTemplateContext(theme: RenderedTemplateTheme, viewer: TemplateViewer): ThemeTemplateContext {
    return { ...theme.results, owner: theme.context.owner, page: theme.context.page, viewer }
}
