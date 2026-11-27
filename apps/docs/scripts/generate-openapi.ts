import { generateFiles } from 'fumadocs-openapi'
import { readdir, unlink } from 'node:fs/promises'
import { openapi } from '../lib/openapi'
import openapiDocument from '../openapi.json'
import { getOperationIds } from './openapi-operations'

const output = new URL('../content/docs/api/', import.meta.url)

await generateFiles({
    input: openapi,
    output: output.pathname,
    includeDescription: true,
})

const expectedPages = new Set(getOperationIds(openapiDocument))
const generatedFiles = await readdir(output)

await Promise.all(
    generatedFiles
        .filter(file =>
            file.endsWith('.mdx') &&
            file !== 'index.mdx' &&
            !expectedPages.has(file.slice(0, -4)),
        )
        .map(file => unlink(new URL(file, output))),
)
