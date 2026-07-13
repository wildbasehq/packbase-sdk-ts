import type { Profile } from './profile'

export interface Pack {
    id: string
    display_name: string
    about?: { bio?: string; flair?: string }
    images?: { avatar?: string; header?: string }
    owner_id?: string
    membership?: {
        id: number
        user_id: string
        permissions: number
    }
    statistics?: { members: number; heartbeat?: number }
    created_at: string
}

export interface PackMember extends Profile {
    membership_id: number
    joined_at: string
    permissions: number
    online?: boolean
    last_online?: string
    roles?: PackRoleSummary[]
}

export interface PackRole {
    id: string
    tenant_id: string
    name: string
    permissions: number
    created_at: string
    updated_at: string
}

export type PackRoleSummary = Pick<PackRole, 'id' | 'name' | 'permissions'>

export interface PackRoleInput {
    name: string
    permissions: number
}

export const PackPermissionBits = {
    Owner: 1,
    Administrator: 2,
    BanMembers: 4,
    KickMembers: 8,
    ManageRoles: 16,
    DeleteHowls: 128,
    CreateHowls: 256,
    ManagePack: 512,
    PinHowls: 1024,
} as const

export type PackPermissionBit = typeof PackPermissionBits[keyof typeof PackPermissionBits]

export interface PackCreateInput {
    display_name: string
    description: string
}

export interface PackEditInput {
    display_name?: string
    about?: { bio?: string; flair?: string }
    images?: { header?: string; avatar?: string }
}

/** Wrapper returned by `GET /packs`. */
export interface PackList {
    has_more: boolean
    packs: Pack[]
    hidden: number
    total_count?: number
}

/** Database-shaped response returned after editing a pack. */
export interface PackUpdateResult {
    id: string
    display_name: string
    description?: string
    owner_id?: string
    images_avatar?: string
    images_header?: string
    created_at: string
}

/** A pack setting together with its schema definition. */
export interface PackSetting {
    key: string
    value: unknown
    definition: unknown
}
