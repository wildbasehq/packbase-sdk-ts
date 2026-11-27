import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { PackEmote, PackEmoteUploadInput, PackEmoteUpdateInput } from '../types/emote'

/** Pack-owned emotes; mutations require ManageEmotes, owner, or administrator access. */
export class PackEmotesResource {
    constructor(private readonly http: HttpClient, private readonly packId: string, private readonly defaults?: RequestOptions) {}
    private path(id?: string) {
        return `/pack/${encodeURIComponent(this.packId)}/emotes${id === undefined ? '' : `/${encodeURIComponent(id)}`}`
    }
    private options(options?: RequestOptions) { return { ...this.defaults, ...options } }

    list(options?: RequestOptions): Promise<PackEmote[]> {
        return this.http.get(this.path(), undefined, this.options(options))
    }
    upload(input: PackEmoteUploadInput, options?: RequestOptions): Promise<PackEmote> {
        return this.http.post(this.path(), input, undefined, this.options(options))
    }
    update(id: string, input: PackEmoteUpdateInput, options?: RequestOptions): Promise<PackEmote> {
        return this.http.put(this.path(id), input, this.options(options))
    }
    /** Disable new use without removing images retained by existing content. */
    remove(id: string, options?: RequestOptions): Promise<void> {
        return this.http.delete(this.path(id), undefined, this.options(options))
    }
}
