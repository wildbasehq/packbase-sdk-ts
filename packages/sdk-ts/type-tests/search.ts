import { feedTemplateContext, from, isErrorEntry, runFeed, themeTemplateContext, viewer, type CustomFeedEditor, type FeedPagination, type FeedTemplateContext, type RunFeedError, type Howl, type PackbaseSDK, type SearchFeed, type ThemeTemplateContext } from '../src'

async function useSearchHowls(pb: PackbaseSDK): Promise<Howl[]> {
    const result = await pb.search({
        posts: { ...from('posts').context('feed').build(), feed: true },
    })
    if (isErrorEntry(result.posts)) throw new Error(result.posts.__error)
    const post = result.posts[0]
    if (post) {
        const count: number = post.likes.count
        const username: string = post.user.username
        const index: number = post.__index
        console.log(count, username, index, post.comments, post.assets, post.moderation_summary)
    }
    return result.posts
}
void useSearchHowls

from('posts').where({ asset_types: { has: 'image' } })
from('posts').where({ asset_types: { hasSome: ['image', 'video'] } })

// @ts-expect-error asset types are restricted to values indexed by the API
from('posts').where({ asset_types: { has: 'audio' } })

// @ts-expect-error asset_types is only queryable on posts
from('profiles').where({ asset_types: { has: 'video' } })

// Viewer placeholders fit list operators and scalar filters.
from('posts').where({ user_id: { in: viewer('following') } })
from('posts').where({ tags: { hasSome: viewer('followed_tags') } })
from('feeds').where({ owner_id: viewer('id') })

// @ts-expect-error unknown viewer keys are rejected
viewer('friends')

from('feeds').where({ pinned: true }).orderBy('pin_position', 'asc')
// @ts-expect-error pinned is only a feeds filter
from('posts').where({ pinned: true })
// @ts-expect-error pin_position orders feeds only
from('packs').orderBy('pin_position')

async function useCustomFeed(pb: PackbaseSDK): Promise<SearchFeed[]> {
    const { feed, pins } = await pb.search({
        feed: runFeed('feed-id', { page: 2 }),
        pins: from('feeds').where({ pinned: true }).build(),
    })
    if (isErrorEntry(feed) || isErrorEntry(pins)) return []
    const hasMore: boolean = feed.has_more
    const loadsMore: string[] = feed.paged
    const pagination: FeedPagination = feed.pagination
    const packbaseManagesWidth: boolean | undefined = feed.presentation?.packbase_manages_width
    const paged: boolean = pagination === 'paged'
    const published: boolean[] = pins.map((pin) => pin.published)
    const covers: string[] = pins.flatMap((pin) => (pin.cover ? [pb.url(pin.cover)] : []))
    const icons: (string | null)[] = pins.map((pin) => pin.icon)
    console.log(covers, icons)
    const templates: Record<string, string> | undefined = feed.presentation?.templates
    const context: FeedTemplateContext = feedTemplateContext(feed, { signedIn: true })
    console.log(templates, context, paged, packbaseManagesWidth, hasMore, loadsMore)
    return pins
}
void useCustomFeed

async function useThemePage(pb: PackbaseSDK): Promise<ThemeTemplateContext | string | null> {
    const page = await pb.themes('profile', 'owner').page()
    if (!page) return null
    if (page.kind === 'template')
        return themeTemplateContext(page, { signedIn: false })
    return page.html
}
void useThemePage

runFeed('feed-id', { workspace: '55555555-5555-4555-8555-555555555555' })
const compileErrors: string[] | undefined = ({ __error: 'invalid', errors: ['templates/feed.hbs: Parse error'] } satisfies RunFeedError).errors
console.log(compileErrors)

async function manageFeed(pb: PackbaseSDK) {
    const editors: CustomFeedEditor[] = await pb.customFeeds.addEditor('feed-id', 'ana')
    await pb.customFeeds.removeEditor('feed-id', editors[0]!.profile.id)
    const { mine } = await pb.search({
        mine: from('feeds').where({ editable: true }).build(),
    })
    if (!isErrorEntry(mine)) {
        const editable: boolean[] = mine.map((feed) => feed.can_edit)
        const keys: (string | null)[] = mine.map((feed) => feed.system_key)
        console.log(editable, keys)
    }
    from('posts').orderBy('network_rank', 'desc')
    // @ts-expect-error network_rank orders posts only
    from('packs').orderBy('network_rank')
}
console.log(manageFeed)
