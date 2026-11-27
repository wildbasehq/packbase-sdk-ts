export interface Paginated<T> {
    data: T[]
    has_more: boolean
    cursor?: string
    total_count?: number
}
