/** A retained Pack image emote. Content metadata remains readable after removal. */
export interface PackEmote {
    id: string
    /** Null if the source Pack was deleted; historical emotes still render. */
    pack_id: string | null
    /** Optional source Pack label for grouping the current member's catalogue. */
    pack_name?: string
    shortcode: string
    label: string
    src: string
    /** Still alternative, including for prefers-reduced-motion. */
    still_src: string
    animated: boolean
    /** Sensitive emotes follow the reader’s blur preference. */
    nsfw?: boolean
}

export interface PackEmoteUploadInput {
    shortcode: string
    label?: string
    nsfw?: boolean
    /** PNG, JPEG, WebP, or GIF as a base64 image data URL; maximum 2 MiB decoded. */
    image: string
}

export interface PackEmoteUpdateInput {
    shortcode?: string
    label?: string
    nsfw?: boolean
}

/** Format an inline reference. The server checks membership again on publication. */
export function formatEmoteToken(emote: Pick<PackEmote, 'id' | 'shortcode'>): string {
    if (!/^[A-Za-z0-9_+-]+(?:~\d+)?$/.test(emote.shortcode) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emote.id)) {
        throw new TypeError('An emote token requires a valid shortcode and UUID.')
    }
    return `:${emote.shortcode}(${emote.id}):`
}
