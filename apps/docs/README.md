# Packbase SDK documentation site

This workspace contains the website for the `@packbase/sdk-ts` documentation. The site uses Next.js, Fumadocs, and the SDK in `packages/sdk-ts`.

Run the commands below from the repository root. Do not run them from `apps/docs`. The repository root contains the top-level `package.json`.

## Run the site locally

Install the repository's dependencies once:

```sh
bun install
```

Then start the development server:

```sh
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The site updates when you save a file. If the site does not update, refresh the browser.

To run only this workspace from the repository root, use:

```sh
bun run --cwd apps/docs dev
```

The `predev` script builds the local SDK first, so examples and TypeScript hints use the current workspace code rather than an older published package.

## Documentation files

Most documentation work happens in `content/docs/(sdk)`. Those MDX files are the handwritten guides, reference pages, and type explanations shown on the site.

The main supporting files are:

| Path | Purpose |
| --- | --- |
| `content/docs/(sdk)` | Handwritten SDK documentation. |
| `content/docs/api` | API pages generated from the OpenAPI document. Do not edit these files. |
| `openapi.json` | OpenAPI document used to build the generated API pages. |
| `components/mdx.tsx` | Components available inside MDX pages. |
| `lib/source.ts` | Connects the MDX content to Fumadocs. |
| `app/(docs)` | Next.js routes and layout for the documentation pages. |

An `.mdx` file contains Markdown and can contain JSX components such as `<Callout>` or `<Cards>`. Edit its prose and code examples as you edit a Markdown file.

Write all documentation in accordance with ASD-STE100. Use short sentences and active voice. Use one instruction in each sentence. Do not change API names, identifiers, or code syntax to conform to controlled language.

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
