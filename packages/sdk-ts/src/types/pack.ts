import type { PackHostRules } from './pack-host'
import type { Profile } from './profile'
import type { JsonValue } from './json'
import type { Paginated } from './common'

export type PackFeedType = 'list' | 'gallery'

export interface Pack {
    host_rules?: PackHostRules
    id: string
    display_name: string
    feed_type: PackFeedType
    about?: { bio?: string | null; flair?: string }
    images?: { avatar?: string | null; header?: string | null }
    owner_id?: string | null
    membership?: {
        id: number
        user_id: string
        permissions: number
    }
    statistics?: { members: number; heartbeat?: number }
    created_at: string
}

/** Bounded pack-list projection; it does not include post-history tags. */
export interface PackMemberSummary extends Omit<Profile, 'default_pack'> {
    membership_id: string
    joined_at: string
    joined_at_stamp?: string
    permissions: number
    online?: boolean | null
    last_online?: string | null
    status?: string
    profile_avatar_mature?: boolean
    profile_banner_mature?: boolean
    profile_howls_mature?: boolean
    invited_by?: string | null
    default_pack?: string | null
    packsId?: string | null
    roles?: PackRoleSummary[]
}

/** Compatibility name for a member summary, not a complete member list. */
export type PackMember = PackMemberSummary
export type PackMemberPage = Paginated<PackMemberSummary>

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
    ViewPackInsights: 2048,
    ManagePackPrompts: 4096,
    ManagePackReports: 8192,
} as const

export type PackPermissionBit = typeof PackPermissionBits[keyof typeof PackPermissionBits]

export interface PackCreateInput {
    display_name: string
    description: string
}

export interface PackEditInput {
    feed_type?: PackFeedType
    display_name?: string
    about?: { bio?: string; flair?: string }
    images?: { header?: string; avatar?: string }
}

/** Wrapper returned by `GET /packs`. */
export interface PackList {
    packs: Pack[]
    hidden: number
    total_count?: number
}

/** Database-shaped response returned after editing a pack. */
export interface PackUpdateResult {
    feed_type: PackFeedType
    id: string
    display_name: string
    description?: string
    owner_id?: string
    images_avatar?: string
    images_header?: string
    created_at: string
}

interface PackSettingDefinitionBase<TType extends string, TDefault> {
    type: TType
    default: TDefault
    user_modifiable: boolean
    display_name: string
    description?: string
    category?: string
    not_implemented?: boolean
    requires?: Record<string, JsonValue>
    [key: string]: unknown
}

export interface BooleanPackSettingDefinition
    extends PackSettingDefinitionBase<'boolean', boolean> {}

export interface StringPackSettingDefinition
    extends PackSettingDefinitionBase<'string', string> {
    values?: string[]
}

export interface NumberPackSettingDefinition
    extends PackSettingDefinitionBase<'number', number> {
    range?: [minimum: number, maximum: number]
}

export interface ArrayPackSettingDefinition
    extends PackSettingDefinitionBase<'array', string | JsonValue[]> {}

export type PackSettingDefinition =
    | BooleanPackSettingDefinition
    | StringPackSettingDefinition
    | NumberPackSettingDefinition
    | ArrayPackSettingDefinition

export type PackSetting = {
    key: string
    value: boolean
    definition: BooleanPackSettingDefinition
} | {
    key: string
    value: string
    definition: StringPackSettingDefinition
} | {
    key: string
    value: number
    definition: NumberPackSettingDefinition
} | {
    key: string
    value: string | JsonValue[]
    definition: ArrayPackSettingDefinition
}
