import type {
    PackbaseSDK,
    ConnectionDefinition,
    ConnectionStatus,
    ConnectionAuthorization,
    ConnectionCompletion,
    FluxerConnection,
    FluxerAuthorization,
    FluxerCompleteResult,
} from '../src'

declare const pb: PackbaseSDK
declare const signal: AbortSignal
const providers: Promise<ConnectionDefinition[]> = pb.me.connections.list({ signal })
const provider = pb.me.connections.provider('discovered-provider')
const status: Promise<ConnectionStatus> = provider.status({ signal })
const authorization: Promise<ConnectionAuthorization> = provider.authorize({ token: 'custom-input' }, { signal })
const completion: Promise<ConnectionCompletion> = provider.complete({ code: 'callback-code', state: 'callback-state' }, { signal })
const disconnected: Promise<void> = provider.disconnect({ signal })
const fluxerStatus: Promise<FluxerConnection> = pb.me.connections.fluxer.status({ signal })
const fluxerAuthorization: Promise<FluxerAuthorization> = pb.me.connections.fluxer.authorize({ pack_id: 'pack', guild_id: '123', install: true }, { signal })
const fluxerCompletion: Promise<FluxerCompleteResult> = pb.me.connections.fluxer.complete({ code: 'callback-code', state: 'callback-state' }, { signal })
// @ts-expect-error The Fluxer shortcut was removed when providers moved under connections.
pb.me.fluxer
// @ts-expect-error Typed Fluxer completion requires both the code and state.
pb.me.connections.fluxer.complete({ code: 'callback-code' })
void [providers, status, authorization, completion, disconnected, fluxerStatus, fluxerAuthorization, fluxerCompletion]
