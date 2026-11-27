import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { PublicSearchProfile, QueryResult, SearchPack, SearchRow } from '../search'
/** Repository owner kinds. `feed` repositories render through `runFeed`, never `page()`. */
export type ThemeKind = 'profile' | 'pack' | 'feed'
export interface ThemeRepositoryStatus {
    enabled: boolean
    repository: null | {
        id: string
        kind: ThemeKind
        owner_id: string
        published_revision: string | null
        clone_url: string
        credential: null | { username: string; created_at: string }
        head_revision: string | null
    }
}
export interface ThemeCredential {
    username: string
    password: string
    url: string
}
export interface ThemeRevision {
    revision: string
    status: 'pending' | 'valid' | 'invalid'
    errors: string[]
    created_at: string
    policy_version: string
    message?: string
    author?: string
    committed_at?: string
    parents?: string[]
}
export type ThemeFileChange =
    | { action: 'save'; path: string; content: string }
    | { action: 'create_file'; path: string; content: string }
    | { action: 'create_folder'; path: string }
    | { action: 'rename'; path: string; destination: string; entry_kind: 'file' | 'folder' }
    | { action: 'delete'; path: string; entry_kind: 'file' | 'folder' }
export interface ThemeCommitChanges {
    revision: string
    parent_revision: string | null
    files: { path: string; status: string; previous_path?: string }[]
    selected_path: string | null
    lines: { type: 'addition' | 'deletion' | 'context' | 'hunk' | 'meta'; text: string; old_line: number | null; new_line: number | null }[]
    binary: boolean
    truncated: boolean
}
export interface ThemeFile {
    path: string
    size: number
    content_hash?: string
    kind?: 'file' | 'folder'
}
export interface ThemeWorkspace {
    staged_paths: string[]
    partially_staged_paths: string[]
    version: string
    base_revision: string
    head_revision: string
    conflicted: boolean
    files: ThemeFile[]
}
/** A sanitized `.html` theme page, pre-rendered by the server. */
export interface RenderedHtmlTheme {
    /** Absent on HTML pages; lets `theme.kind === 'template'` narrow the union. */
    kind?: undefined
    repository_id: string
    revision: string
    policy_version: string
    html: string
    css: string
    pages: string[]
}
/** A `.hbs` theme page: the client renders `entry` from `templates` with `themeTemplateContext`. */
export interface RenderedTemplateTheme {
    repository_id: string
    revision: string
    kind: 'template'
    entry: string
    templates: Record<string, string>
    css: string
    context: { owner: PublicSearchProfile | SearchPack; page: string }
    /** The outputs of the theme's boot script, run as the reader; lists have the shapes `POST /search` returns. */
    results: Record<string, QueryResult<SearchRow>>
}
/** Narrow with `theme.kind === 'template'`. */
export type RenderedTheme = RenderedHtmlTheme | RenderedTemplateTheme
/** Repository controls use the normal session, never the generated repository password. */
export class ThemeRepositoryResource {
    private readonly path: string
    constructor(
        private readonly http: HttpClient,
        private readonly kind: ThemeKind,
        private readonly ownerId: string,
    ) {
        this.path = `/theme-repositories/${encodeURIComponent(kind)}/${encodeURIComponent(ownerId)}`
    }
    status(options?: RequestOptions): Promise<ThemeRepositoryStatus> {
        return this.http.getFresh(this.path, options)
    }
    create(options?: RequestOptions): Promise<ThemeRepositoryStatus> {
        return this.http.post(this.path, undefined, undefined, options)
    }
    /** Show once; never persist the returned password or put it in a URL. */
    rotateCredential(options?: RequestOptions): Promise<ThemeCredential> {
        return this.http.post(
            `${this.path}/credential`,
            undefined,
            undefined,
            options,
        )
    }
    revokeCredential(options?: RequestOptions): Promise<void> {
        return this.http.delete(`${this.path}/credential`, undefined, options)
    }
    revisions(options?: RequestOptions): Promise<ThemeRevision[]> {
        return this.http.getFresh(`${this.path}/revisions`, options)
    }
    files(revision: string, options?: RequestOptions): Promise<ThemeFile[]> {
        return this.http.getFresh(`${this.path}/files`, options, { revision })
    }
    file(
        revision: string,
        path: string,
        options?: RequestOptions,
    ): Promise<{ path: string; content: string }> {
        return this.http.getFresh(`${this.path}/file`, options, { revision, path })
    }
    /** Save an existing text file as a private revision; rejects a stale repository head. */
    saveFile(
        expectedRevision: string,
        path: string,
        content: string,
        options?: RequestOptions,
    ): Promise<{ revision: string }> {
        return this.http.post(
            `${this.path}/file`,
            { expected_revision: expectedRevision, path, content },
            undefined,
            options,
        )
    }
    /** Create, rename or delete a file/folder in one private, conflict-checked revision. */
    changeFiles(expectedRevision: string, change: ThemeFileChange, options?: RequestOptions): Promise<{ revision: string }> {
        return this.http.post(`${this.path}/changes`, { expected_revision: expectedRevision, change }, undefined, options)
    }
    /** Git-generated changes against the selected commit's first parent (or the empty root). */
    changes(revision: string, path?: string, options?: RequestOptions): Promise<ThemeCommitChanges> {
        return this.http.getFresh(`${this.path}/changes`, options, { revision, path })
    }
    workspace(options?: RequestOptions): Promise<ThemeWorkspace> {
        return this.http.getFresh(`${this.path}/workspace`, options)
    }
    /** Discard the working copy and restore the latest commit without changing Git history. */
    discardWorkspace(version: string, options?: RequestOptions): Promise<ThemeWorkspace> {
        return this.http.post(`${this.path}/workspace/discard`, { version }, undefined, options)
    }
    resetWorkspaceToTemplate(version: string, options?: RequestOptions): Promise<ThemeWorkspace> {
        return this.http.post(`${this.path}/workspace/reset-template`, { version }, undefined, options)
    }
    workspaceFile(version: string, path: string, options?: RequestOptions): Promise<{ path: string; content: string }> {
        return this.http.getFresh(`${this.path}/workspace/file`, options, { version, path })
    }
    workspaceChanges(version: string, path?: string, options?: RequestOptions): Promise<ThemeCommitChanges> {
        return this.http.getFresh(`${this.path}/workspace/changes`, options, { version, path })
    }
    changeWorkspace(version: string, change: ThemeFileChange, options?: RequestOptions): Promise<ThemeWorkspace> {
        return this.http.post(`${this.path}/workspace/change`, { version, change }, undefined, options)
    }
    workspaceSnapshot(version: string, path: string, staged = false, options?: RequestOptions): Promise<{ path: string; content: string | null; content_hash: string | null; base_content: string | null }> {
        return this.http.getFresh(`${this.path}/workspace/snapshot`, options, { version, path, staged })
    }
    commitLocalWorkspace(version: string, message: string, snapshot: { base_revision: string; files: { path: string; content: string | null }[] }, options?: RequestOptions): Promise<{ revision: string; workspace: ThemeWorkspace }> {
        return this.http.post(`${this.path}/workspace/commit-local`, { version, message, snapshot }, undefined, options)
    }
    stageWorkspace(version: string, paths: string[], staged: boolean, options?: RequestOptions): Promise<ThemeWorkspace> {
        return this.http.post(`${this.path}/workspace/stage`, { version, paths, staged }, undefined, options)
    }
    stagedWorkspaceChanges(version: string, path?: string, options?: RequestOptions): Promise<ThemeCommitChanges> {
        return this.http.getFresh(`${this.path}/workspace/changes`, options, { version, path, staged: true })
    }
    commitStagedWorkspace(version: string, message: string, options?: RequestOptions): Promise<{ revision: string; workspace: ThemeWorkspace }> {
        return this.http.post(`${this.path}/workspace/commit`, { version, message, staged_only: true }, undefined, options)
    }
    commitWorkspace(version: string, message: string, options?: RequestOptions): Promise<{ revision: string; workspace: ThemeWorkspace }> {
        return this.http.post(`${this.path}/workspace/commit`, { version, message }, undefined, options)
    }
    preview(
        revision: string,
        page = '',
        options?: RequestOptions,
    ): Promise<RenderedTheme | null> {
        return this.http.getFresh(
            `${this.path}/preview`,
            options,
            { revision, page },
        )
    }
    publish(
        revision: string,
        expectedRevision: string | null,
        options?: RequestOptions,
    ): Promise<ThemeRepositoryStatus> {
        return this.http.post(
            `${this.path}/publish`,
            { revision, expected_revision: expectedRevision },
            undefined,
            options,
        )
    }
    disable(
        expectedRevision: string | null,
        options?: RequestOptions,
    ): Promise<ThemeRepositoryStatus> {
        return this.http.post(
            `${this.path}/disable`,
            { expected_revision: expectedRevision },
            undefined,
            options,
        )
    }
    page(
        page = '',
        maturityConfirmed = false,
        options?: RequestOptions,
    ): Promise<RenderedTheme | null> {
        return this.http.getFresh(
            `/theme-pages/${encodeURIComponent(this.kind)}/${encodeURIComponent(this.ownerId)}`,
            options,
            { page, maturity_confirmed: maturityConfirmed },
        )
    }
}
export type ThemesFn = (
    kind: ThemeKind,
    ownerId: string,
) => ThemeRepositoryResource
export function makeThemes(http: HttpClient): ThemesFn {
    return (kind, ownerId) => new ThemeRepositoryResource(http, kind, ownerId)
}
