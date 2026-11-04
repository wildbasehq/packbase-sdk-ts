import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { PackchatStatus, PackchatSettings, PackchatConfigureInput, PackchatChannels, PackchatMessages } from '../types/packchat'

export interface PackchatMessageOptions extends RequestOptions {
    /** Fetch older messages before this Fluxer message ID. */
    before?: string
}

/** Read-only Fluxer community chat. Management always requires the actual pack owner. */
export class PackchatResource {
    constructor(private readonly http: HttpClient, private readonly id: string, private readonly defaults?: RequestOptions) {}
    private path(suffix = '') { return `/pack/${encodeURIComponent(this.id)}/chat${suffix}` }
    private options(options?: RequestOptions) { return { ...this.defaults, ...options } }

    status(options?: RequestOptions): Promise<PackchatStatus> {
        return this.http.get(this.path(), undefined, this.options(options))
    }
    settings(options?: RequestOptions): Promise<PackchatSettings> {
        return this.http.get(this.path('/settings'), undefined, this.options(options))
    }
    link(input: { guild_id: string }, options?: RequestOptions): Promise<PackchatStatus> {
        return this.http.post(this.path('/link'), input, undefined, this.options(options))
    }
    configure(input: PackchatConfigureInput, options?: RequestOptions): Promise<PackchatStatus> {
        return this.http.put(this.path('/settings'), input, this.options(options))
    }
    unlink(options?: RequestOptions): Promise<void> {
        return this.http.delete(this.path(), undefined, this.options(options))
    }
    /** Resolve a vanity URL or ask the bot to create/reuse a community invite. */
    invite(options?: RequestOptions): Promise<{ url: string }> {
        return this.http.post(this.path('/invite'), undefined, undefined, this.options(options))
    }
    channels(options?: RequestOptions): Promise<PackchatChannels> {
        return this.http.get(this.path('/channels'), undefined, this.options(options))
    }
    messages(channelId: string, options?: PackchatMessageOptions): Promise<PackchatMessages> {
        return this.http.get(this.path(`/channels/${encodeURIComponent(channelId)}/messages`), { before: options?.before }, this.options(options))
    }
}
