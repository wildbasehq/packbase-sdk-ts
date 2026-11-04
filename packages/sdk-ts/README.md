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
- `pb.me.maintenance` reviews, confirms, and tracks bulk howl deletion or factory reset.
- `pb.me.fluxer` verifies the signed-in member's Fluxer identity; `pb.packs(id).packchat` links an owned community and reads selected channels.
- `pb.profiles(id)` returns a lazy, awaitable profile handle.
- `pb.packs(id)` returns a lazy, awaitable pack handle; `pb.packs.list()` and `.create()` work with packs in bulk.
- `pb.howls(id)` returns a lazy, awaitable howl handle; `pb.howls.create()` creates a howl and `pb.howls.upload` manages assets.
- `pb.feeds(id).fetch()` fetches a paginated feed.
- `pb.inbox` manages notifications.
- `pb.invites` manages authenticated invite codes and pre-signup waitlist referrals with `getWaitlistReferral()` and `redeemWaitlistReferral()`.
- `pb.tags()` lists registered tag names; `pb.tags.get()` fetches metadata, while `create()`, `update()`, and `delete()` manage tags for staff and content moderators. Authenticated users can manage feed interests with `pb.tags.follow()`, `pb.tags.unfollow()`, and `pb.tags.following()`.
- `pb.feedback.submit()` sends product feedback for the authenticated user.
- `pb.leaderboard`, `pb.store`, `pb.folders`, and `pb.search()` expose their corresponding API endpoints.

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

## Account migrations

SDK 0.7 adds `pb.migrations`: `services`, `create`, `verify`, `start`, `cancel`,
`retry`, and `status`. Build forms from the server's versioned service schema;
it owns inputs, limits, destination requirements, ownership proof, and temporary
account restrictions. Status and schema reads bypass HTTP caches, and all migration
responses are runtime-validated. The legacy create-via-verify request is removed.

```ts
const { services } = await pb.migrations.services()
const { migrations, account_locked } = await pb.migrations.status()
```

## Account maintenance and independent quotes

SDK 0.7.2 adds `pb.me.maintenance.preview`, `confirm`, `current`, `status`,
`retry`, and `acknowledge`. Bulk deletion matches every supplied tag. Factory
reset clears personal content/settings and social connections, leaves joined
packs, and retains owned packs, login identity, moderation history, balances,
entitlements, and invite/referral/import history.

Show the server's review counts and samples before confirmation. The server
requires an exact typed username and enforces the returned `confirm_after`
time (10 seconds for bulk deletion, 30 seconds for reset). Reusing a confirmed
token resumes the same durable operation. Changed or expired review scopes
must be reviewed again. Current/status reads bypass caches; failed operations
can be retried, and completed operations must be acknowledged. Aborting a
request does not cancel confirmed deletion.

```ts
const review = await pb.me.maintenance.preview({ kind: 'bulk_delete', tags: ['old'] })
const { operation } = await pb.me.maintenance.current()
```

Quote howls use an independent `quote_source_id`. They keep their own body,
assets, likes, and replies after the source is deleted. When
`quote_source_unavailable` is true, render an unavailable-source message;
do not display a saved copy of deleted source content. Regular rehowls and
replies still cascade with their parent. `parent_id` in creation input means
the source to quote; use `.comment()` to create a reply.


`me.maintenance.current()` always returns `last_reset_id: string | null`: the latest confirmed factory reset, including after acknowledgement when `operation` is null. A preview never changes it. Compare this server marker before restoring local drafts or cached personal state so another tab's reset cannot restore old data.

## Howl likes

Every howl and comment includes `likes: { emoji, count, likedByMe }`. Each member
can like a howl once; both methods below are idempotent and send no request body:

```ts
await pb.howls('howl-id').like()
await pb.howls('howl-id').unlike()
await pb.me.settings({ howl_like_emoji: '🔥' })
```

`howl_like_emoji` defaults to 🔥. The server snapshots the author's choice when a
howl is created. Updating the setting affects new howls only. SDK 0.8.0 exports
`HowlLikes` and requires the new likes API.

`comment()` returns `HowlCommentResult` (`{ id, likes }`). Reconcile optimistic
replies with its authoritative emoji snapshot instead of cached user settings.


## Blocking, muting, and live visibility (0.9.0)

```ts
await pb.me.mutes.add(profileId)
await pb.me.mutes.remove(profileId)
await pb.me.blocks.add(profileId)
const page = await pb.me.blocks.list({ limit: 25 })
await pb.me.blocks.remove(profileId)
```

These owner-only operations use immutable IDs. Lists return static identity snapshots for managing outgoing records. Muting hides feed howls and nested previews while preserving profile/direct reads. Blocking is enforced by the server in both directions, including counterpart-owned packs and historical content; normal inaccessible reads return 404. Blocking removes both follows, and unblocking does not restore them.

Post searches return fully hydrated howls, including authors, media, likes, replies, and public moderation summaries; render them without per-post detail requests. `SearchPost` extends `Howl` with selection metadata. Feed searches support `from('posts').context('feed')`; nested previews retain that context. If separately refreshing a howl, pass `{context: 'feed'}` to `pb.howls(id, options)`. Use direct context for explicit profile reads. Context never bypasses blocking.

`pb.visibility.watch({cursor, waitMs: 25000, signal})` performs an uncached, optional-auth long poll returning only `{cursor, changed}`. On changes, call `pb.invalidateVisibility()` and immediately evict/conceal application content caches before refetching. Local relationship changes automatically invalidate and emit `visibilityChanged`. Use `getVisibilityGeneration()` to fence multi-request application work. SDK resource handles and in-flight reads reconcile generations; mutations are never automatically retried. The application owns the watch loop, reconnect/wake handling, and previously returned objects.
