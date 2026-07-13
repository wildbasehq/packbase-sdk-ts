import type { HttpClient } from '../http'
import type { RequestOptions } from '../cache'
import type { Howl } from '../types/howl'
import type {
    Pack,
    PackCreateInput,
    PackEditInput,
    PackList,
    PackMember,
    PackRole,
    PackRoleInput,
    PackRoleSummary,
    PackSetting,
    PackUpdateResult,
} from '../types/pack'
import type { ReportReasonValue, ReportResult } from '../types/report'
import { ThenableResource } from './base'

/**
 * A handle for a single pack. Await it to fetch the pack's details, or call
 * one of its methods to perform actions on that pack.
 *
 * @example
 * ```ts
 * const pack = await pb.packs('pack-uuid')
 * const { data } = await pb.packs('pack-uuid').members()
 * await pb.packs('pack-uuid').join()
 * await pb.packs('pack-uuid').ban('member-uuid')
 * ```
 */
export class PackHandle extends ThenableResource<Pack> {
    constructor(
        private readonly http: HttpClient,
        private readonly id: string,
        private readonly requestOptions?: RequestOptions,
    ) {
        super()
    }

    /**
     * Fetches the pack's member list (`GET /pack/:id/members`).
     *
     * @returns All pack members, ordered by online status and recent activity.
     */
    members(options?: RequestOptions): Promise<PackMember[]> {
        return this.http.get<PackMember[]>(
            `/pack/${this.id}/members`,
            undefined,
            options,
        )
    }

    /** Lists roles for this pack (`GET /pack/:id/roles`). */
    roles(options?: RequestOptions): Promise<PackRole[]> {
        return this.http.get<PackRole[]>(`/pack/${this.id}/roles`, undefined, options)
    }

    /** Creates a role for this pack (`POST /pack/:id/roles`). */
    createRole(data: PackRoleInput): Promise<PackRole> {
        return this.http.post<PackRole>(`/pack/${this.id}/roles`, data)
    }

    /** Updates a role for this pack (`PUT /pack/:id/roles/:roleId`). */
    updateRole(roleId: string, data: PackRoleInput): Promise<PackRole> {
        return this.http.put<PackRole>(`/pack/${this.id}/roles/${roleId}`, data)
    }

    /** Deletes a role from this pack (`DELETE /pack/:id/roles/:roleId`). */
    deleteRole(roleId: string): Promise<{ success: boolean }> {
        return this.http.delete<{ success: boolean }>(`/pack/${this.id}/roles/${roleId}`)
    }

    /** Replaces the roles assigned to a member (`PUT /pack/:id/member/:memberId/roles`). */
    setMemberRoles(memberId: string, roleIds: string[]): Promise<{ roles: PackRoleSummary[]; permissions: number }> {
        return this.http.put<{ roles: PackRoleSummary[]; permissions: number }>(`/pack/${this.id}/member/${memberId}/roles`, {
            role_ids: roleIds,
        })
    }

    /**
     * Joins this pack as a member (`POST /pack/:id/join`).
     *
     * Throws `PackbaseError` with `isConflict: true` if you are already a member.
     *
     * @returns The pack and user IDs for the new membership.
     */
    join(): Promise<{ tenant_id: string; user_id: string }> {
        return this.http.post(`/pack/${this.id}/join`)
    }

    /** Leaves this pack (`DELETE /pack/:id/join`). */
    leave(): Promise<void> {
        return this.http.delete<void>(`/pack/${this.id}/join`)
    }

    /**
     * Updates pack metadata (`POST /pack/:id`).
     *
     * Requires the `ManagePack` permission. Only the fields you pass are changed.
     *
     * @param data - Fields to update.
     * @returns The updated pack.
     */
    update(data: PackEditInput): Promise<PackUpdateResult> {
        return this.http.post<PackUpdateResult>(`/pack/${this.id}`, data)
    }

    /**
     * Fetches pack settings (`GET /pack/:id/settings`).
     *
     * @returns Settings together with their schema definitions.
     */
    settings(options?: RequestOptions): Promise<PackSetting[]> {
        return this.http.get<PackSetting[]>(`/pack/${this.id}/settings`, undefined, options)
    }

    /**
     * Bans a member from this pack (`POST /pack/:id/member/:memberId/ban`).
     *
     * Requires moderation permissions.
     *
     * @param memberId - The user's UUID.
     */
    ban(memberId: string): Promise<void> {
        return this.http.post<void>(`/pack/${this.id}/member/${memberId}/ban`)
    }

    /**
     * Kicks a member from this pack (`POST /pack/:id/member/:memberId/kick`).
     *
     * Requires moderation permissions.
     *
     * @param memberId - The user's UUID.
     */
    kick(memberId: string): Promise<void> {
        return this.http.post<void>(`/pack/${this.id}/member/${memberId}/kick`)
    }

    /**
     * Reports this pack for a violation (`POST /pack/:id/report`).
     *
     * @param reason - The reason for the report. Use a `ReportReason` value.
     * @param notes - Optional extra context to include with the report.
     * @returns Resolves when the report is submitted.
     *
     * @example
     * ```ts
     * import { ReportReason } from '@packbase/sdk-ts'
     *
     * await pb.packs('pack-id').report(ReportReason.HarassmentOrBullying)
     * await pb.packs('pack-id').report(ReportReason.Other, 'Additional context.')
     * ```
     */
    report(reason: ReportReasonValue, notes?: string): Promise<ReportResult> {
        return this.http.post<ReportResult>(`/pack/${this.id}/report`, { reason, notes })
    }

    /**
     * Lists pinned howls for this pack (`GET /pack/:id/pins`).
     *
     * @returns The pinned howls, ordered by pin time.
     */
    pins(options?: RequestOptions): Promise<{ data: Howl[] }> {
        return this.http.get<{ data: Howl[] }>(`/pack/${this.id}/pins`, undefined, options)
    }

    /**
     * Pins a howl to this pack's feed (`POST /pack/:id/pins/:howlId`).
     *
     * Requires the `PinHowls` permission. Packs support up to 5 pins.
     *
     * @param howlId - The howl UUID to pin.
     */
    pinHowl(howlId: string, options?: { expiresAt?: string | Date | null }): Promise<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(`/pack/${this.id}/pins/${howlId}`, {
            expires_at: options?.expiresAt instanceof Date
                ? options.expiresAt.toISOString()
                : (options?.expiresAt ?? null),
        })
    }

    /**
     * Removes a pinned howl from this pack (`DELETE /pack/:id/pins/:howlId`).
     *
     * Requires the `PinHowls` permission.
     *
     * @param howlId - The howl UUID to unpin.
     */
    unpinHowl(howlId: string): Promise<{ success: boolean }> {
        return this.http.delete<{ success: boolean }>(`/pack/${this.id}/pins/${howlId}`)
    }

    /** Fetches `GET /pack/:id` using the pack UUID. */
    protected fetch(): Promise<Pack> {
        return this.http.get<Pack>(`/pack/${this.id}`, undefined, this.requestOptions)
    }
}

/**
 * The type of `pb.packs`.
 *
 * Call it with a UUID to get a `PackHandle`, or use the static methods
 * to list or create packs:
 *
 * ```ts
 * pb.packs('pack-uuid')        // returns PackHandle
 * pb.packs.list()              // returns Promise<PackList>
 * pb.packs.create({ ... })     // returns Promise<Pack>
 * ```
 */
export type PacksFn = {
    (id: string, options?: RequestOptions): PackHandle
    /**
     * Fetches all packs (`GET /packs`).
     *
     * @returns The pack list together with hidden-pack metadata.
     */
    list(options?: RequestOptions): Promise<PackList>
    /**
     * Creates a new pack (`POST /pack/create`).
     *
     * @param data - Required pack creation fields.
     * @returns The newly created pack.
     */
    create(data: PackCreateInput): Promise<Pack>
}

/**
 * Builds the `packs` callable used on `PackbaseSDK`.
 *
 * @param http - The shared `HttpClient` instance.
 * @returns A callable that accepts a pack UUID and returns a `PackHandle`,
 *          with `list` and `create` attached as static methods.
 */
export function makePacks(http: HttpClient): PacksFn {
    function packs(id: string, options?: RequestOptions): PackHandle {
        return new PackHandle(http, id, options)
    }

    packs.list = (options?: RequestOptions): Promise<PackList> =>
        http.get<PackList>('/packs', undefined, options)

    packs.create = (data: PackCreateInput): Promise<Pack> =>
        http.post<Pack>('/pack/create', data)

    return packs as PacksFn
}
