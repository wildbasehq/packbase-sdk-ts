# Contributing

This repository uses Bun workspaces. Install dependencies once from the repository root with `bun install`.

- Keep SDK changes in `packages/sdk-ts`.
- Keep documentation changes in `apps/docs`.
- Run the narrowest relevant validation first. Run `bun run verify` before handing off cross-workspace changes.
- The SDK is publishable; the docs app is private and must retain its workspace dependency on `@packbase/sdk-ts`.
