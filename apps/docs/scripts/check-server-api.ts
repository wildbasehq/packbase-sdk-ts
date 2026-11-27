import { readFile } from 'node:fs/promises'
import document from '../openapi.json'

// Optional local audit. Normal docs builds do not require a server checkout.
const routeFile = process.argv[2] ?? new URL('../../../../korat-hb/apps/server/src/routes/contract.json', import.meta.url)
const routes = JSON.parse(await readFile(routeFile, 'utf8')) as string[]
const methods = new Set(['get', 'post', 'put', 'patch', 'delete'])
const normalize = (value: string) => value.replace(/\{[^}]+\}|:[^/ ]+/g, ':parameter')
const publicRoutes = routes.filter(route => !/^\w+ \/(?:admin|account|appeal-portal)(?:\/|$)/.test(route))
const documented = Object.entries(document.paths).flatMap(([path, operations]) =>
    Object.keys(operations).filter(method => methods.has(method)).map(method => `${method.toUpperCase()} ${path}`),
)
const actual = new Set(publicRoutes.map(normalize))
const expected = new Set(documented.map(normalize))
const missing = publicRoutes.filter(route => !expected.has(normalize(route)))
const stale = documented.filter(route => {
    if (actual.has(normalize(route))) return false
    // The shared connection interface describes each enabled literal provider.
    if (route.includes('/connections/{provider}')) {
        const pattern = new RegExp(`^${route.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{provider}', '[^/]+')}$`)
        return !publicRoutes.some(candidate => pattern.test(candidate))
    }
    return true
})
if (missing.length || stale.length) throw new Error([
    missing.length ? `Public server operations missing from docs:\n${missing.join('\n')}` : '',
    stale.length ? `Documented operations absent from server:\n${stale.join('\n')}` : '',
].filter(Boolean).join('\n'))

console.log(`Server route coverage valid: ${publicRoutes.length} public operations; admin routes excluded`)
