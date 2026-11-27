import { expect, test } from 'bun:test'
import { emoteFallback, findEmoteTokens, formatEmoteToken, parseEmoteToken } from '../src/emotes'

const id = '12345678-1234-4234-8234-123456789abc'
test('the lightweight entry formats and parses stable ID references without a client', () => {
  const value = formatEmoteToken({id, shortcode:'wave~2'})
  expect(value).toBe(`:wave~2(${id}):`)
  expect(parseEmoteToken(value)).toEqual({id,shortcode:'wave~2',value,offset:0})
  expect(parseEmoteToken(`before ${value}`)).toBeNull()
  expect(parseEmoteToken(`${value} after`)).toBeNull()
  expect(parseEmoteToken(':wave(not-a-uuid):')).toBeNull()
})
test('matches use UTF-16 offsets, are reentrant, and retain unresolved token spelling', () => {
  const value = `:wave(${id}):`
  const text = `😀 ${value} ${value}`
  const tokens = findEmoteTokens(text)
  expect(tokens.map(token=>token.offset)).toEqual([3,4+value.length])
  expect(findEmoteTokens(text)).toEqual(tokens)
  expect(emoteFallback(text)).toBe('😀 :wave: :wave:')
  expect(emoteFallback(':wave(not-a-uuid):')).toBe(':wave(not-a-uuid):')
  expect(findEmoteTokens(`:wave(${id.toUpperCase()}):`)[0]?.id).toBe(id.toUpperCase())
})
