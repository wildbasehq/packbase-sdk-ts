import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { JsonValue } from '../types/json'

/** An email invitation created through Clerk. */
export interface Invite {
    invite_id: string
    created_at: string
    [key: string]: JsonValue
}

/** A direct-access code visible to its creator or credited inviter. */
export interface AccessCode {
    id: string
    code: string
    url: string
    created_at: string
    status: 'active' | 'reserved' | 'exhausted' | 'revoked'
    credited_user_id: string
    credited_username: string
    created_by_me: boolean
    /** Staff-only fields; never present in a regular member's response. */
    max_uses?: number
    used_count?: number
    pending_count?: number
}

/** Current rolling code allowance; null means unlimited staff creation. */
export interface AccessCodeAllowance {
    remaining: number | null
    next_refresh_at: string | null
}

/** Cursor page of direct-access codes owned or credited to the caller. */
export interface AccessCodeList {
    codes: AccessCode[]
    allowance: AccessCodeAllowance
    next_cursor: string | null
}

export interface AccessCodeListOptions extends RequestOptions {
    cursor?: string
}

/** Staff must supply both fields; regular members create one-use codes with no overrides. */
export interface CreateAccessCodeInput {
    credited_user_id?: string
    max_uses?: number
}

export interface AccessCodeClaimResult {
    success: true
}

export interface AccessCodeRevokeResult {
    success: true
}

export interface CreditedUser {
    id: string
    username: string
    display_name: string | null
    images_avatar: string | null
}

export interface CreditedUserSearch {
    users: CreditedUser[]
}

/** A waitlist member's referral details. */
export interface WaitlistReferral {
    /** The member's eight-character referral code. */
    code: string
    /** Shareable Packbase signup URL containing the referral code. */
    url: string
    /** Number of waitlist members who have redeemed this code. */
    referrals: number
    /** Waitlist priority points earned from referrals. */
    priority: number
    /** The referral code this member redeemed, when present. */
    referred_by?: string
}

/** Result returned after applying a waitlist referral code. */
export interface RedeemWaitlistReferralResult {
    /** Whether the referral code was applied. */
    success: boolean
    /** The normalized referral code that was applied. */
    referrer_code: string
}

/** Email invites, direct-access codes, and pre-signup waitlist referrals. */
export interface InvitesResource {
    /**
     * Fetches the authenticated user's invite list.
     *
     * @returns The user's invite records.
     */
    list(options?: RequestOptions): Promise<Invite[]>

    /**
     * Sends an email invitation.
     *
     * @param email - Address to invite.
     * @returns The created invitation record.
     */
    generate(email: string, options?: RequestOptions): Promise<Invite>

    /** Lists direct-access codes and the caller's current creation allowance. */
    listAccessCodes(options?: AccessCodeListOptions): Promise<AccessCodeList>

    /** Creates a direct-access code; staff must choose the credited user and use limit. */
    createAccessCode(input?: CreateAccessCodeInput, options?: RequestOptions): Promise<AccessCode>

    /** Sends a verification invitation to an email for a valid code or link. */
    claimAccessCode(code: string, email: string, options?: RequestOptions): Promise<AccessCodeClaimResult>

    /** Revokes a code and its pending verification invitations. */
    revokeAccessCode(id: string, options?: RequestOptions): Promise<void>

    /** Searches eligible credited users; available to staff only. */
    searchCreditedUsers(query: string, options?: RequestOptions): Promise<CreditedUser[]>

    /**
     * Gets or creates referral details for a Clerk waitlist entry.
     *
     * The waitlist entry ID is sensitive and is validated by the server. This
     * endpoint is intended for people who are still on the Clerk waitlist and
     * does not require an authenticated Packbase profile.
     *
     * @param waitlistId - Clerk waitlist entry ID from Clerk's `useWaitlist()`.
     * @returns The waitlist member's referral code, link, and referral totals.
     *
     * @example
     * ```ts
     * const referral = await pb.invites.getWaitlistReferral(waitlist.id)
     * console.log(referral.url)
     * ```
     */
    getWaitlistReferral(waitlistId: string, options?: RequestOptions): Promise<WaitlistReferral>

    /**
     * Applies another member's referral code to a Clerk waitlist entry.
     *
     * A waitlist entry can redeem at most one code and cannot redeem its own
     * code. The server treats referral codes case-insensitively.
     *
     * @param waitlistId - Clerk waitlist entry ID from Clerk's `useWaitlist()`.
     * @param code - Referral code to apply (one to eight characters).
     * @returns Confirmation containing the normalized referrer's code.
     *
     * @example
     * ```ts
     * await pb.invites.redeemWaitlistReferral(waitlist.id, 'ABCD1234')
     * ```
     */
    redeemWaitlistReferral(
        waitlistId: string,
        code: string,
        options?: RequestOptions,
    ): Promise<RedeemWaitlistReferralResult>
}

/**
 * Creates the email invite, access-code, and waitlist referral resource.
 *
 * @param http - SDK HTTP client.
 * @returns Invite and waitlist referral methods.
 */
export function makeInvites(http: HttpClient): InvitesResource {
    return {
        list: (options?: RequestOptions) => http.get<Invite[]>('/invite/list', undefined, options),
        generate: (email: string, options?: RequestOptions) =>
            http.post<Invite>('/invite/generate', {email}, undefined, options),
        listAccessCodes: (options: AccessCodeListOptions = {}) =>
            http.get<AccessCodeList>('/invite/access-codes', {cursor: options.cursor}, options),
        createAccessCode: (input: CreateAccessCodeInput = {}, options?: RequestOptions) =>
            http.post<AccessCode>('/invite/access-codes', input, undefined, options),
        claimAccessCode: (code: string, email: string, options?: RequestOptions) =>
            http.post<AccessCodeClaimResult>('/invite/access-codes/claim', {code, email}, undefined, options),
        revokeAccessCode: (id: string, options?: RequestOptions) =>
            http.post<AccessCodeRevokeResult>(`/invite/access-codes/${encodeURIComponent(id)}/revoke`, {}, undefined, options)
                .then(() => undefined),
        searchCreditedUsers: (query: string, options?: RequestOptions) =>
            http.get<CreditedUserSearch>('/invite/credited-users', {query}, options)
                .then((result) => result.users),
        getWaitlistReferral: (waitlistId: string, options?: RequestOptions) =>
            http.get<WaitlistReferral>('/invite/my-referral', { id: waitlistId }, options),
        redeemWaitlistReferral: (waitlistId: string, code: string, options?: RequestOptions) =>
            http.post<RedeemWaitlistReferralResult>(
                '/invite/redeem-referral',
                { code },
                { id: waitlistId },
                options,
            ),
    }
}
