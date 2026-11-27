import { expect, test } from 'bun:test'
import { feedTemplateContext, themeTemplateContext, type CustomFeedRun, type RenderedTemplateTheme } from '../src'
import { FEED_CONTEXT, THEME_CONTEXT } from '../src/scripts'

const feed = { id: 'f', display_name: 'Feed', description: '', owner: { id: 'o' }, pinned: false, pin_count: 0 } as unknown as CustomFeedRun['feed']

test('a feed template receives each output by its own name, beside what the feed always gives', () => {
    const run = { feed, results: { posts: [{ id: 'a' }], total: 1 }, paged: ['posts'], page: 2, has_more: true } as unknown as CustomFeedRun
    expect(feedTemplateContext(run, { signedIn: true })).toEqual({
        posts: [{ id: 'a' }],
        total: 1,
        feed,
        viewer: { signedIn: true },
        page: 2,
        hasMore: true,
    })
})

test('what a template always receives is never replaced by an output of the same name', () => {
    const run = { feed, results: { page: 'mine', viewer: 'mine', feed: 'mine', hasMore: 'mine' }, page: 1, has_more: false } as unknown as CustomFeedRun
    const context = feedTemplateContext(run, { signedIn: false })
    expect(context).toEqual({ feed, viewer: { signedIn: false }, page: 1, hasMore: false })
    expect(Object.keys(context).sort()).toEqual([...FEED_CONTEXT].sort())
})

test('a theme page receives its outputs the same way', () => {
    const theme = { context: { owner: { id: 'o' }, page: 'about' }, results: { latest: [], owner: 'mine' } } as unknown as RenderedTemplateTheme
    const context = themeTemplateContext(theme, { signedIn: true })
    expect(context as Record<string, unknown>).toEqual({ latest: [], owner: { id: 'o' }, page: 'about', viewer: { signedIn: true } })
    expect(Object.keys(context).filter((key) => key !== 'latest').sort()).toEqual([...THEME_CONTEXT].sort())
})
