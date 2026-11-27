import {afterEach, expect, test} from 'bun:test'
import {PackbaseSDK} from '../src'
const originalFetch = globalThis.fetch
afterEach(() => {globalThis.fetch = originalFetch})
test('protected tags use authenticated PUT with the full protected set', async () => {
  let request: RequestInit | undefined
  let url = ''
  globalThis.fetch = (async (input, init) => {url = String(input); request = init; return Response.json({tags:['rating_safe','spoiler'],moderator_tags:['spoiler'],tag_revision:1,edit:{id:'1'}})}) as typeof fetch
  const sdk = new PackbaseSDK({baseUrl:'https://api.example.test',apiKey:'staff-token',autoLogin:false})
  const signal = new AbortController().signal
  await sdk.howls('id').moderatorTags({tags:['spoiler'],explanation:'Keep the spoiler label in place.',expected_revision:0}, {signal})
  expect(url).toBe('https://api.example.test/howl/id/moderator-tags')
  expect(request?.method).toBe('PUT')
  expect(JSON.parse(String(request?.body))).toEqual({tags:['spoiler'],explanation:'Keep the spoiler label in place.',expected_revision:0})
  expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer staff-token')
  expect(request?.signal).toBe(signal)
})
test('summary reads retain context, strip private extras and reject unknown actions', async () => {
  let url = ''
  let response: unknown = {status:'reviewed',actions:['warning'],reporter:'secret',internal_notes:'secret'}
  globalThis.fetch = (async (input) => {url=String(input);return Response.json(response)}) as typeof fetch
  const sdk = new PackbaseSDK({baseUrl:'https://api.example.test',autoLogin:false})
  expect(await sdk.howls('id', {context:'direct'}).moderation()).toEqual({status:'reviewed',actions:['warning']})
  expect(url).toContain('context=direct')
  response = {status:{value:'reviewed'},actions:[]}
  await expect(sdk.howls('id').moderation()).rejects.toThrow('Invalid moderation summary')
  response = {status:'reviewed',actions:['private-investigation']}
  await expect(sdk.howls('id').moderation()).rejects.toThrow('Invalid moderation summary')
})
