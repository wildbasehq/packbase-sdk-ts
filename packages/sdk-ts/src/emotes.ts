/** Lightweight emote toolkit. No HTTP client, authentication, React, or browser globals. */
export { formatEmoteToken } from './types/emote'
export type { PackEmote, PackEmoteUploadInput, PackEmoteUpdateInput } from './types/emote'

export type EmoteToken = {
  id: string
  shortcode: string
  value: string
  /** Zero-based UTF-16 offset in the input string. */
  offset: number
}

const tokenSource = ':([A-Za-z0-9_+-]+(?:~\\d+)?)\\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\\):'

/** Find stable ID references, preserving their source spelling and positions. */
export function findEmoteTokens(text: string): EmoteToken[] {
  return [...text.matchAll(new RegExp(tokenSource, 'g'))].map(match => ({
    id: match[2]!, shortcode: match[1]!,  value: match[0], offset: match.index,
  }))
}

/** Parse one complete token. Unknown/removed emotes can still have valid tokens. */
export function parseEmoteToken(text: string): EmoteToken | null {
  const token = findEmoteTokens(text)[0]
  return token?.offset === 0 && token.value.length === text.length ? token : null
}

/** Render readable shortcode text when metadata is unavailable. Never invent image URLs. */
export function emoteFallback(text: string): string {
  return text.replace(new RegExp(tokenSource, 'g'), ':$1:')
}
