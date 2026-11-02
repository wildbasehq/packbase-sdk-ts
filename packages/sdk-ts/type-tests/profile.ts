import type { UpdateProfileInput } from '../src/types/profile'

const avatarUpdate = {
    images: { avatar: 'data:image/png;base64,iVBORw0KGgo' },
} satisfies UpdateProfileInput

void avatarUpdate

const removedSlug = {
    // @ts-expect-error Use username to update identity through Clerk.
    slug: 'unused',
} satisfies UpdateProfileInput
void removedSlug
