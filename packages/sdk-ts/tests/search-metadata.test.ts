import { describe, expect, test } from 'bun:test'
import { FILTER_OPERATORS, SEARCH_FIELDS, SEARCH_MODELS } from '../src'

const names = (model: keyof typeof SEARCH_FIELDS) => SEARCH_FIELDS[model].map((field) => field.name)

describe('search metadata', () => {
    test('lists every model', () => {
        expect([...SEARCH_MODELS]).toEqual(['posts', 'profiles', 'packs', 'feeds'])
    })

    test('lists every allowed field per model, plus virtual fields', () => {
        expect(names('posts')).toEqual([
            'id', 'created_at', 'tenant_id', 'content_type', 'body',
            'user_id', 'parent', 'tags', 'assets', 'asset_types', 'network_rank',
        ])
        expect(names('packs')).toEqual([
            'id', 'created_at', 'display_name', 'images_avatar',
            'description', 'owner_id', 'images_header', 'last_activity_at',
        ])
        expect(names('feeds')).toEqual([
            'id', 'created_at', 'updated_at', 'display_name', 'description', 'owner_id',
            'pin_count', 'system_key', 'default_position', 'pinned', 'editable', 'pin_position',
        ])
        expect(names('profiles')).toContain('profile_howls_mature')
    })

    test('marks order-only and filter-only fields', () => {
        const field = (model: keyof typeof SEARCH_FIELDS, name: string) =>
            SEARCH_FIELDS[model].find((entry) => entry.name === name)
        expect(field('posts', 'network_rank')).toEqual({ name: 'network_rank', type: 'number', filter: false, order: true })
        expect(field('feeds', 'pin_position')).toMatchObject({ filter: false, order: true })
        expect(field('feeds', 'pinned')).toEqual({ name: 'pinned', type: 'boolean', filter: true, order: false })
        expect(field('feeds', 'editable')).toMatchObject({ filter: true, order: false })
        expect(field('posts', 'tags')).toMatchObject({ type: 'text[]', filter: true })
    })

    test('groups operators by value type', () => {
        expect([...FILTER_OPERATORS['text[]']]).toEqual(['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'])
        expect(FILTER_OPERATORS.text).toContain('contains')
        expect(FILTER_OPERATORS.number).toContain('gte')
        expect(FILTER_OPERATORS.boolean).toEqual(['equals', 'not'])
        const every = new Set(Object.values(FILTER_OPERATORS).flat())
        for (const type of new Set(Object.values(SEARCH_FIELDS).flat().map((field) => field.type)))
            expect(FILTER_OPERATORS[type].length).toBeGreaterThan(0)
        expect(every.has('mode')).toBe(true)
    })
})
