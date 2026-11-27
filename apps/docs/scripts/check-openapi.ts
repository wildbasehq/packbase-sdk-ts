import { readdir } from 'node:fs/promises'
import openapiDocument from '../openapi.json'
import { getOperationIds } from './openapi-operations'

const operationIds = getOperationIds(openapiDocument)

for (const path of Object.keys(openapiDocument.paths)) {
    if (/^\/admin(?:\/|$)/.test(path)) throw new Error(`Admin routes must not be documented: ${path}`)
}

function checkReferences(value: unknown): void {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(checkReferences); return }
    const object = value as Record<string, unknown>
    if (typeof object.$ref === 'string' && object.$ref.startsWith('#/')) {
        let target: unknown = openapiDocument
        for (const segment of object.$ref.slice(2).split('/')) {
            const name = segment.replace(/~1/g, '/').replace(/~0/g, '~')
            target = target && typeof target === 'object' ? (target as Record<string, unknown>)[name] : undefined
        }
        if (target === undefined) throw new Error(`Unresolved OpenAPI reference: ${object.$ref}`)
    }
    Object.values(object).forEach(checkReferences)
}
checkReferences(openapiDocument)

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
