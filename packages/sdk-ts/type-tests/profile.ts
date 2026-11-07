import type { UpdateProfileInput } from '../src/types/profile'
import type { Profile, Pack, UpdateProfileResult } from '../src'

declare const publicProfile: Profile
const defaultPack: string | Pack | null | undefined = publicProfile.default_pack
const bot: Profile['type'] = 'BOT'
void [defaultPack, bot]
declare const saved: UpdateProfileResult
const savedBio: string | undefined = saved.bio
void savedBio
// @ts-expect-error Saved bios are returned flat, not under the input's about field.
saved.about

const avatarUpdate = {
    images: { avatar: 'data:image/png;base64,iVBORw0KGgo' },
} satisfies UpdateProfileInput

void avatarUpdate

const removedSlug = {
    // @ts-expect-error Use username to update identity through Clerk.
    slug: 'unused',
} satisfies UpdateProfileInput
void removedSlug
