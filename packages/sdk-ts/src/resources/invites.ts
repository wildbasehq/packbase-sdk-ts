import type { HttpClient } from '../http'
import type { RequestOptions } from '../request'
import type { JsonValue } from '../types/json'

/** An email invitation created through Clerk. */
export interface Invite {
    invite_id: string
    created_at: string
    [key: string]: JsonValue
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

/** Invite and pre-signup waitlist referral endpoints. */
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
 * Creates the invite and waitlist referral resource.
 *
 * @param http - SDK HTTP client.
 * @returns Invite and waitlist referral methods.
 */
export function makeInvites(http: HttpClient): InvitesResource {
    return {
        list: (options?: RequestOptions) => http.get<Invite[]>('/invite/list', undefined, options),
        generate: (email: string, options?: RequestOptions) =>
            http.post<Invite>('/invite/generate', {email}, undefined, options),
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
