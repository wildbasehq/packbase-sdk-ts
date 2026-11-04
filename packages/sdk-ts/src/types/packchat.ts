/** Fluxer snowflake IDs remain strings throughout Packchat. */
export type PackchatAudience = 'public' | 'pack_members' | 'pack_and_fluxer_members'

export interface FluxerGuild {
    id: string
    name: string
    icon?: string | null
}

export interface PackchatCommunity extends FluxerGuild {
    url: string
}

export interface PackchatStatus {
    enabled: boolean
    linked: boolean
    status: 'disabled' | 'unlinked' | 'linked' | 'unavailable'
    audience: PackchatAudience
    generation?: string
    community?: PackchatCommunity
    channel_ids: string[]
    can_manage: boolean
    fluxer_connected: boolean
}

export interface PackchatChannel {
    id: string
    name: string
    type: number
}

export interface PackchatSettings extends PackchatStatus {
    available_channels: Array<PackchatChannel & { private: boolean }>
    owned_guilds: FluxerGuild[]
}

export interface PackchatConfigureInput {
    audience: PackchatAudience
    channel_ids: string[]
    /** Required when publishing channels to a broader audience. */
    confirm_publish?: boolean
}

export interface PackchatChannels {
    channels: PackchatChannel[]
    generation: string
    /** Clear displayed chat when this lease expires unless a fresh read succeeds. */
    authorization_expires_at: string
    community: PackchatCommunity
}

export interface PackchatMessage {
    id: string
    content: string
    timestamp: string
    edited_timestamp: string | null
    author: {
        id: string
        username: string
        display_name?: string | null
        avatar_url?: string | null
    }
    attachments: Array<{
        id: string
        filename: string
        url: string
        content_type?: string
        size?: number
        width?: number
        height?: number
    }>
}

export interface PackchatMessages {
    messages: PackchatMessage[]
    has_more: boolean
    before?: string | null
    generation: string
    authorization_expires_at: string
    channel_id: string
}

export interface FluxerConnection {
    connected: boolean
    user?: { id: string; username: string; avatar?: string | null }
    owned_guilds: FluxerGuild[]
}

export interface FluxerAuthorizeInput {
    pack_id?: string
    guild_id?: string
    install?: boolean
}

export interface FluxerAuthorization {
    authorization_url: string
}

export interface FluxerCompleteInput {
    code: string
    state: string
}

export interface FluxerCompleteResult {
    connected: true
    pack_id?: string
    return_path: string
}
