import type { RequestOptions } from '../request'
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
    create(data: FolderInput, options?: RequestOptions): Promise<{folder: Folder}>
    /** Fetches a folder and its owner. */
    get(id: string, options?: RequestOptions): Promise<{folder: Folder; profile: FolderOwner}>
    /** Updates a folder owned by the authenticated user. */
    update(id: string, data: Partial<FolderInput>, options?: RequestOptions): Promise<{folder: Folder}>
    /** Deletes a folder owned by the authenticated user. */
    delete(id: string, options?: RequestOptions): Promise<{success: boolean}>
    /** Pins a howl to a folder. */
    addHowl(folderId: string, howlId: string, options?: RequestOptions): Promise<{success: boolean}>
    /** Unpins a howl from a folder. */
    removeHowl(folderId: string, howlId: string, options?: RequestOptions): Promise<{success: boolean}>
}

export function makeFolders(http: HttpClient): FoldersResource {
    return {
        list: (userId, options) => http.get<{folders: Folder[]}>(
            '/folders',
            {user: userId},
            options,
        ),
        create: (data, options) => http.post<{folder: Folder}>('/folders', data, undefined, options),
        get: (id, options) => http.get<{folder: Folder; profile: FolderOwner}>(
            `/folder/${encodeURIComponent(id)}`,
            undefined,
            options,
        ),
        update: (id, data, options) => http.patch<{folder: Folder}>(
            `/folder/${encodeURIComponent(id)}`,
            data,
            options,
        ),
        delete: (id, options) => http.delete<{success: boolean}>(
            `/folder/${encodeURIComponent(id)}`,
            undefined,
            options,
        ),
        addHowl: (folderId, howlId, options) => http.post<{success: boolean}>(
            `/folder/${encodeURIComponent(folderId)}/howls`,
            {howl_id: howlId},
            undefined,
            options,
        ),
        removeHowl: (folderId, howlId, options) => http.delete<{success: boolean}>(
            `/folder/${encodeURIComponent(folderId)}/howls/${encodeURIComponent(howlId)}`,
            undefined,
            options,
        ),
    }
}
