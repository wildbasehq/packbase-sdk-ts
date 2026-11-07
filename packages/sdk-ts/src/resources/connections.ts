import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import { FluxerResource } from './fluxer'

export interface ConnectionDefinition {
    id: string
    name: string
    description: string
    disconnect_description: string
    method: 'oauth2' | 'custom'
    fields: Array<{ name: string; label: string; type: 'text' | 'password' }>
}
export interface ConnectionStatus {
    connected: boolean
    user?: { id: string; username: string; avatar?: string | null }
}
export type ConnectionAuthorization = { authorization_url: string } | { connected: true; return_path?: string }
export interface ConnectionCompletion { connected: true; return_path: string }

/** Generic access for server-registered providers, including custom authorization methods. */
export class ConnectionResource {
    private readonly path: string
    constructor(private readonly http: HttpClient, provider: string) {
        this.path = `/user/me/connections/${encodeURIComponent(provider)}`
    }
    status(options?: RequestOptions): Promise<ConnectionStatus> { return this.http.get(this.path, undefined, options) }
    authorize(input: Record<string, unknown> = {}, options?: RequestOptions): Promise<ConnectionAuthorization> { return this.http.post(`${this.path}/authorize`, input, undefined, options) }
    complete(input: Record<string, unknown>, options?: RequestOptions): Promise<ConnectionCompletion> { return this.http.post(`${this.path}/complete`, input, undefined, options) }
    disconnect(options?: RequestOptions): Promise<void> { return this.http.delete(this.path, undefined, options) }
}

export class ConnectionsResource {
    readonly fluxer: FluxerResource
    constructor(private readonly http: HttpClient) { this.fluxer = new FluxerResource(http) }
    list(options?: RequestOptions): Promise<ConnectionDefinition[]> { return this.http.get('/user/me/connections', undefined, options) }
    provider(id: string): ConnectionResource { return new ConnectionResource(this.http, id) }
}
