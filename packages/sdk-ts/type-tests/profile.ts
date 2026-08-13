import type { UpdateProfileInput } from '../src/types/profile'

const avatarUpdate = {
    images: { avatar: 'data:image/png;base64,iVBORw0KGgo' },
} satisfies UpdateProfileInput

void avatarUpdate
