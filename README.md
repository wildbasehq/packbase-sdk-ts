# Packbase TypeScript SDK

This Bun monorepo contains the Packbase TypeScript SDK and its documentation site.

| Workspace | Location | Purpose |
| --- | --- | --- |
| `@packbase/sdk-ts` | `packages/sdk-ts` | Publishable, dependency-free typed API client. |
| `pbsdk-typescript-docs` | `apps/docs` | Next.js and Fumadocs documentation site. |

## Development

```sh
bun install
bun run dev
```

The docs app depends on the local workspace SDK. Its lifecycle scripts build the SDK before starting, type-checking, or building the site.

## Validation

```sh
bun run typecheck
bun run test
bun run build
```

To prepare the SDK for npm publication, run:

```sh
bun --filter @packbase/sdk-ts run verify
```
