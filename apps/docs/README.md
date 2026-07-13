# Packbase SDK documentation site

This workspace contains the website for the `@packbase/sdk-ts` documentation. It's built with Next.js and Fumadocs, and it uses the SDK from `packages/sdk-ts` in this same repository.

If you're new to monorepos: run the commands below from the repository root, not from `apps/docs`. The root is the folder that contains the top-level `package.json`.

## Run the site locally

Install the repository's dependencies once:

```sh
bun install
```

Then start the development server:

```sh
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Changes should appear as you save them. Refresh the browser if they don't.

To run only this workspace from the repository root, use:

```sh
bun run --cwd apps/docs dev
```

The `predev` script builds the local SDK first, so examples and TypeScript hints use the current workspace code rather than an older published package.

## Where things live

Most documentation work happens in `content/docs/(sdk)`. Those MDX files are the handwritten guides, reference pages, and type explanations shown on the site.

The main supporting files are:

| Path | Purpose |
| --- | --- |
| `content/docs/(sdk)` | Handwritten SDK documentation. |
| `content/docs/api` | API pages generated from the OpenAPI document. Don't edit these by hand. |
| `openapi.json` | OpenAPI document used to build the generated API pages. |
| `components/mdx.tsx` | Components available inside MDX pages. |
| `lib/source.ts` | Connects the MDX content to Fumadocs. |
| `app/(docs)` | Next.js routes and layout for the documentation pages. |

An `.mdx` file is mostly Markdown, with a little JSX when the page needs components such as `<Callout>` or `<Cards>`. If you're only changing prose or code examples, it should feel much like editing a normal Markdown file.

## Check your changes

Run the docs type check from the repository root:

```sh
bun run --cwd apps/docs types:check
```

For a broader check that also builds the site and tests the SDK, run:

```sh
bun run verify
```

The code examples in MDX are type-checked during the docs build. This stops examples from drifting away from the actual SDK.

For more on the underlying tools, see the [Next.js documentation](https://nextjs.org/docs), the [Fumadocs documentation](https://fumadocs.dev), and the [Fumadocs MDX guide](https://fumadocs.dev/docs/mdx).
