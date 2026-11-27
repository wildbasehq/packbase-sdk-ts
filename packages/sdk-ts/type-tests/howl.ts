import type { Howl } from '../src/types/howl'
import type { HowlComment, HowlCommentResult, HowlLikes, PackbaseSDK, HowlTagEditResult, HowlTagHistoryEntry, Paginated } from '../src'

declare const howl: Howl

const concreteRecordId: string = howl.id
const canonicalInteractionId: string | undefined = howl.canonical_id
const legacyRehowlId: string | undefined = howl.rehowl_id

void concreteRecordId
void canonicalInteractionId
void legacyRehowlId

declare const comment: HowlComment
declare const sdk: PackbaseSDK
const likes: HowlLikes = howl.likes
const liked: boolean = comment.likes.likedByMe
const likeResult: Promise<void> = sdk.howls('id').like()
const unlikeResult: Promise<void> = sdk.howls('id').unlike()
const commentResult: Promise<HowlCommentResult> = sdk.howls('id').comment('Reply')

// @ts-expect-error Likes always include the current member's state.
const incompleteLikes: HowlLikes = { emoji: '🔥', count: 0 }
// @ts-expect-error The author controls the emoji; liking takes request options only.
sdk.howls('id').like('🔥')
// @ts-expect-error Reaction methods are removed.
sdk.howls('id').react('🔥')
// @ts-expect-error Reaction methods are removed.
sdk.howls('id').unreact()
// @ts-expect-error Howls expose one likes summary.
howl.reactions
// @ts-expect-error Comments expose one likes summary.
comment.reactions

void likes
void liked
void likeResult
void unlikeResult
void incompleteLikes
void commentResult

const tagEdit: Promise<HowlTagEditResult> = sdk.howls('id').setTags({tags: ['rating_safe'], explanation: 'Corrected the rating.', expected_revision: 0})
const tagHistory: Promise<Paginated<HowlTagHistoryEntry>> = sdk.howls('id').tagHistory({cursor: '1'})
const protectedEdit: Promise<HowlTagEditResult> = sdk.howls('id').moderatorTags({tags: ['spoiler'], explanation: 'Protect the spoiler label.', expected_revision: 1})
const canEdit: boolean | undefined = howl.can_edit_tags
const canManageLocks: boolean | undefined = howl.can_manage_tag_locks
const tagRevision: number | undefined = howl.tag_revision

// @ts-expect-error Every tag edit requires a public explanation.
sdk.howls('id').setTags({tags: ['rating_safe'], expected_revision: 0})
// @ts-expect-error Every tag edit requires the current numeric revision.
sdk.howls('id').setTags({tags: ['rating_safe'], explanation: 'Corrected the rating.'})
// @ts-expect-error Moderator edits also require an explanation and revision.
sdk.howls('id').moderatorTags(['spoiler'])

void tagEdit
void tagHistory
void protectedEdit
void canEdit
void canManageLocks
void tagRevision
