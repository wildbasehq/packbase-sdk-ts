import type { CreateTagInput, PackbaseSDK, Tag, UpdateTagInput } from '../src'

declare const pb: PackbaseSDK

const names: Promise<string[]> = pb.tags()
const tag: Promise<Tag> = pb.tags.get('digital_art')
const followedTags: Promise<string[]> = pb.tags.following()
const followed: Promise<void> = pb.tags.follow('digital_art')
const unfollowed: Promise<void> = pb.tags.unfollow('digital_art')

const input: CreateTagInput = {
    tag: 'digital_art',
    title: 'Digital art',
    description: '<p>Artwork made with digital tools.</p>',
}
const created: Promise<Tag> = pb.tags.create(input)
const update: UpdateTagInput = { title: 'Digital illustration' }
const updated: Promise<Tag> = pb.tags.update('digital_art', update)
const deleted: Promise<void> = pb.tags.delete('digital_art')

// @ts-expect-error A human-readable title is required.
pb.tags.create({ tag: 'digital_art', description: '<p>Digital art.</p>' })

// @ts-expect-error A tag update must change its title or description.
pb.tags.update('digital_art', {})

// @ts-expect-error Machine-readable tag identifiers cannot be renamed.
pb.tags.update('digital_art', { tag: 'illustration' })

void names
void tag
void followedTags
void followed
void unfollowed
void created
void updated
void deleted
