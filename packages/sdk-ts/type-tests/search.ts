import { from, isErrorEntry, type Howl, type PackbaseSDK } from '../src'

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
