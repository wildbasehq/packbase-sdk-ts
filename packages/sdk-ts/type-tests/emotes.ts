import { formatEmoteToken, PackPermissionBits, type PackbaseSDK, type PackEmote, type Profile, type Howl } from '../src'

declare const pb: PackbaseSDK
declare const emote: PackEmote
declare const profile: Profile
declare const howl: Howl
const token: string = formatEmoteToken(emote)
const available: Promise<PackEmote[]> = pb.me.emotes()
const listed: Promise<PackEmote[]> = pb.packs('pack').emotes.list()
const uploaded: Promise<PackEmote> = pb.packs('pack').emotes.upload({shortcode: 'wave', image: 'data:image/png;base64,AA=='})
const updated: Promise<PackEmote> = pb.packs('pack').emotes.update(emote.id, {label: 'Hello'})
const removed: Promise<void> = pb.packs('pack').emotes.remove(emote.id)
const retained: PackEmote[] | undefined = profile.emotes
const likeImage: PackEmote | undefined = howl.likes.emote
const permission: 16384 = PackPermissionBits.ManageEmotes
// @ts-expect-error Uploads require image data.
pb.packs('pack').emotes.upload({shortcode: 'wave'})
// @ts-expect-error Image replacement is a new upload, not a metadata edit.
pb.packs('pack').emotes.update(emote.id, {image: 'data:image/png;base64,AA=='})
void [token, available, listed, uploaded, updated, removed, retained, likeImage, permission]
