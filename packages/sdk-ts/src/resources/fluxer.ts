import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type {
    FluxerConnection,
    FluxerAuthorizeInput,
    FluxerAuthorization,
    FluxerCompleteInput,
    FluxerCompleteResult,
} from '../types/packchat'

/** The authenticated member's verified Fluxer identity. Tokens stay on the server. */
export class FluxerResource {
    constructor(
        private readonly http: HttpClient,
        private readonly instance: 'fluxer' | 'fluxfur' = 'fluxer',
    ) {}
    status(options?: RequestOptions): Promise<FluxerConnection> {
        return this.http.get(
            `/user/me/connections/${this.instance}`,
            undefined,
            options,
        )
    }
    authorize(
        input: FluxerAuthorizeInput = {},
        options?: RequestOptions,
    ): Promise<FluxerAuthorization> {
        return this.http.post(
            `/user/me/connections/${this.instance}/authorize`,
            input,
            undefined,
            options,
        )
    }
    complete(
        input: FluxerCompleteInput,
        options?: RequestOptions,
    ): Promise<FluxerCompleteResult> {
        return this.http.post(
            `/user/me/connections/${this.instance}/complete`,
            input,
            undefined,
            options,
        )
    }
    disconnect(options?: RequestOptions): Promise<void> {
        return this.http.delete(
            `/user/me/connections/${this.instance}`,
            undefined,
            options,
        )
    }
}
