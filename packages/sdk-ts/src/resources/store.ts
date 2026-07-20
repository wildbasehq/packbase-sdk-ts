import type { RequestOptions } from '../cache'
import type { HttpClient } from '../http'
import type { JsonValue } from '../types/json'

export interface StoreItem {
    id: string
    title: string
    description?: string
    type: string
    price: number
    stackable: boolean
    maxQuantity?: number
    ownedAmount?: number
}

export interface StoreHistoryEntry {
    id: string
    action: string
    model_object: JsonValue
}

export interface StoreOverview {
    items: StoreItem[]
    trinketCount: number
    history: StoreHistoryEntry[]
}

export interface StorePurchase {
    item: StoreItem
    quantity: number
    newTrinketBalance: number
    inventory: {
        item_id: string
        amount: number
        type: string
    }
}

export interface StoreResource {
    /** Lists store items with the current user's ownership and balance. */
    list(options?: RequestOptions): Promise<StoreOverview>
    /** Lists the public item catalog without ownership information. */
    catalog(options?: RequestOptions): Promise<{items: StoreItem[]}>
    /** Purchases a store item. `userId` is accepted only for staff purchases. */
    purchase(itemId: string, options?: StorePurchaseOptions): Promise<StorePurchase>
}

export interface StorePurchaseOptions extends RequestOptions {
    quantity?: number
    userId?: string
}

export function makeStore(http: HttpClient): StoreResource {
    return {
        list: options => http.get<StoreOverview>('/store', undefined, options),
        catalog: options => http.get<{items: StoreItem[]}>('/store/catalog', undefined, options),
        purchase: (itemId, options) => http.post<StorePurchase>(
            `/store/${encodeURIComponent(itemId)}`,
            options && {
                quantity: options.quantity,
                user_id: options.userId,
            },
            undefined,
            options,
        ),
    }
}
