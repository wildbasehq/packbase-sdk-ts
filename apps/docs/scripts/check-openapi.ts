import { readdir } from 'node:fs/promises'
import openapiDocument from '../openapi.json'
import { getOperationIds } from './openapi-operations'

const operationIds = getOperationIds(openapiDocument)

const generatedPages = new Set(
    (await readdir(new URL('../content/docs/api', import.meta.url)))
        .filter(file => file.endsWith('.mdx') && file !== 'index.mdx')
        .map(file => file.slice(0, -4)),
)
const expectedPages = new Set(operationIds)
const missingPages = operationIds.filter(operationId => !generatedPages.has(operationId))
const stalePages = [...generatedPages].filter(page => !expectedPages.has(page))

if (missingPages.length > 0 || stalePages.length > 0) {
    throw new Error(
        [
            missingPages.length > 0 ? `missing pages: ${missingPages.join(', ')}` : '',
            stalePages.length > 0 ? `stale pages: ${stalePages.join(', ')}` : '',
            'Run `bun run --cwd apps/docs generate:api`.',
        ].filter(Boolean).join('\n'),
    )
}

console.log(`OpenAPI documentation valid: ${operationIds.length} operations`)
