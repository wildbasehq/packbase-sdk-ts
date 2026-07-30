# @packbase/sdk-ts

A typed, dependency-free TypeScript client for the [Packbase API](https://packbase.app).

## Installation

```sh
npm install @packbase/sdk-ts
```

The package ships native ESM and type declarations. It supports Node.js 18 or later and modern browsers with the standard `fetch` API.

## Quick start

```ts
import { PackbaseSDK } from '@packbase/sdk-ts'

const pb = new PackbaseSDK({
    apiKey: process.env.PACKBASE_API_KEY,
})

const profile = await pb.profiles('rek')
const { packs } = await pb.packs.list()
```

When no `apiKey` is supplied, the SDK uses cookie-based authentication. This is useful in browser applications where the Packbase session cookie is already set.

```ts
import { PackbaseSDK, type Profile } from '@packbase/sdk-ts'

const pb = new PackbaseSDK()

pb.on('ready', profile => {
    console.log(`Signed in as ${profile.username}`)
})

pb.on('error', error => {
    console.error('Unable to authenticate', error)
})

const onReady = (profile: Profile) => console.log(profile.username)
pb.on('ready', onReady)
pb.off('ready', onReady)
```

For public-only use, disable the automatic `me()` request with
`new PackbaseSDK({autoLogin: false})`.

## Resources

- `pb.me()` gets the authenticated profile; `pb.me.update()` updates it.
- `pb.profiles(id)` returns a lazy, awaitable profile handle.
- `pb.packs(id)` returns a lazy, awaitable pack handle; `pb.packs.list()` and `.create()` work with packs in bulk.
- `pb.howls(id)` returns a lazy, awaitable howl handle; `pb.howls.create()` creates a howl and `pb.howls.upload` manages assets.
- `pb.feeds(id).fetch()` fetches a paginated feed.
- `pb.inbox` manages notifications.
- `pb.invites` manages authenticated invite codes and pre-signup waitlist referrals with `getWaitlistReferral()` and `redeemWaitlistReferral()`.
- `pb.leaderboard`, `pb.store`, `pb.folders`, `pb.tags()`, and `pb.search()` expose their corresponding API endpoints.

Howl creation accepts `body: string | null`; strings may contain plain text or
HTML and are sanitized by the server. Authored howls use
`content_type: 'text'`, which the SDK supplies when omitted. Object bodies are
rejected before a request is sent.

Resource handles do not issue a request until they are awaited:

```ts
const pack = pb.packs('00000000-0000-0000-0000-000000000000')

await pack.join() // POST /pack/00000000-0000-0000-0000-000000000000/join
const details = await pack // GET /pack/00000000-0000-0000-0000-000000000000
```

## Configuration

```ts
const pb = new PackbaseSDK({
    baseUrl: 'https://vgs.packbase.app',
    apiKey: 'your-api-key-or-clerk-jwt',
    autoLogin: false,
})
```

`baseUrl` defaults to `https://vgs.packbase.app`.

The SDK does not maintain its own response cache. Add response caching in your
application's data layer when needed.

Every request accepts an `AbortSignal`, either directly through
`RequestOptions` or alongside its operation-specific options:

```ts
const controller = new AbortController()
await pb.packs.list({search: 'art', signal: controller.signal})
```

## Development

```sh
bun install
bun run verify
```

`verify` runs the type check, tests, release build, and an npm package dry run. Publishing runs the same verification through `prepublishOnly`.

## License

[MIT](LICENSE)
