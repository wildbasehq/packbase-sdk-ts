export interface Notification {
    id: string
    created_at: string
    user_id: string
    type: string
    title: string
    content?: string
    read: boolean
    read_at?: string | null
    metadata?: unknown
    related_id?: string | null
}
