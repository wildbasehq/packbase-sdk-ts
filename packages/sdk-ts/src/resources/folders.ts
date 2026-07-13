import type { RequestOptions } from '../cache'
import type { HttpClient } from '../http'

export interface Folder {
    id: string
    name: string
    description?: string
    emoji?: string
    query?: string
    assets?: string[]
    howl_count?: number
    howl_ids?: string[]
    created_at?: string
    updated_at?: string
}

export interface FolderInput {
    name: string
    description?: string
    emoji?: string
    query?: string
}

export interface FolderOwner {
    id: string
    display_name: string
    username: string
    images_avatar: string
}

export interface FoldersResource {
    /** Lists folders belonging to a user. */
    list(userId: string, options?: RequestOptions): Promise<{folders: Folder[]}>
    /** Creates a folder for the authenticated user. */
    create(data: FolderInput): Promise<{folder: Folder}>
    /** Fetches a folder and its owner. */
    get(id: string, options?: RequestOptions): Promise<{folder: Folder; profile: FolderOwner}>
    /** Updates a folder owned by the authenticated user. */
    update(id: string, data: Partial<FolderInput>): Promise<{folder: Folder}>
    /** Deletes a folder owned by the authenticated user. */
    delete(id: string): Promise<{success: boolean}>
}

export function makeFolders(http: HttpClient): FoldersResource {
    return {
        list: (userId, options) => http.get<{folders: Folder[]}>(
            '/folders',
            {user: userId},
            options,
        ),
        create: data => http.post<{folder: Folder}>('/folders', data),
        get: (id, options) => http.get<{folder: Folder; profile: FolderOwner}>(
            `/folder/${encodeURIComponent(id)}`,
            undefined,
            options,
        ),
        update: (id, data) => http.patch<{folder: Folder}>(
            `/folder/${encodeURIComponent(id)}`,
            data,
        ),
        delete: id => http.delete<{success: boolean}>(`/folder/${encodeURIComponent(id)}`),
    }
}
