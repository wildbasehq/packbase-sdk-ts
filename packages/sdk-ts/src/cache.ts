/** Options that override the SDK's cache policy for a single read request. */
export interface RequestOptions {
    /** Whether this request may read from and write to the cache. */
    cache?: boolean
    /** Time-to-live for this response in milliseconds. */
    cacheTtlMs?: number
    /** Cancels the request when the signal is aborted. */
    signal?: AbortSignal
}

interface CacheEntry {
    expiresAt: number
    value: unknown
}

interface CacheStore {
    get(key: string): Promise<CacheEntry | undefined>
    set(key: string, entry: CacheEntry): Promise<void>
    delete(key: string): Promise<void>
    clear(namespace: string): Promise<void>
}

const memoryEntries = new Map<string, CacheEntry>()

class MemoryCacheStore implements CacheStore {
    async get(key: string): Promise<CacheEntry | undefined> {
        return memoryEntries.get(key)
    }

    async set(key: string, entry: CacheEntry): Promise<void> {
        const now = Date.now()
        for (const [cachedKey, cachedEntry] of memoryEntries) {
            if (cachedEntry.expiresAt <= now) memoryEntries.delete(cachedKey)
        }
        memoryEntries.set(key, entry)
    }

    async delete(key: string): Promise<void> {
        memoryEntries.delete(key)
    }

    async clear(namespace: string): Promise<void> {
        const prefix = `${namespace}:`
        for (const key of memoryEntries.keys()) {
            if (key.startsWith(prefix)) memoryEntries.delete(key)
        }
    }
}

const DATABASE_NAME = 'packbase-sdk-cache'
const DATABASE_VERSION = 1
const STORE_NAME = 'responses'

class IndexedDBCacheStore implements CacheStore {
    private databasePromise: Promise<IDBDatabase> | null = null
    private readonly fallback = new MemoryCacheStore()

    async get(key: string): Promise<CacheEntry | undefined> {
        try {
            const database = await this.database()
            return await new Promise<CacheEntry | undefined>((resolve, reject) => {
                const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key)
                request.onsuccess = () => resolve(request.result as CacheEntry | undefined)
                request.onerror = () => reject(request.error)
            })
        } catch {
            return this.fallback.get(key)
        }
    }

    async set(key: string, entry: CacheEntry): Promise<void> {
        try {
            const database = await this.database()
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite')
                transaction.objectStore(STORE_NAME).put(entry, key)
                transaction.oncomplete = () => resolve()
                transaction.onerror = () => reject(transaction.error)
                transaction.onabort = () => reject(transaction.error)
            })
        } catch {
            await this.fallback.set(key, entry)
        }
    }

    async delete(key: string): Promise<void> {
        await this.fallback.delete(key)
        try {
            const database = await this.database()
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite')
                transaction.objectStore(STORE_NAME).delete(key)
                transaction.oncomplete = () => resolve()
                transaction.onerror = () => reject(transaction.error)
                transaction.onabort = () => reject(transaction.error)
            })
        } catch {}
    }

    async clear(namespace: string): Promise<void> {
        await this.fallback.clear(namespace)
        try {
            const database = await this.database()
            const prefix = `${namespace}:`
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite')
                const request = transaction.objectStore(STORE_NAME).openCursor()
                request.onsuccess = () => {
                    const cursor = request.result
                    if (!cursor) return
                    if (String(cursor.key).startsWith(prefix)) cursor.delete()
                    cursor.continue()
                }
                request.onerror = () => reject(request.error)
                transaction.oncomplete = () => resolve()
                transaction.onerror = () => reject(transaction.error)
                transaction.onabort = () => reject(transaction.error)
            })
        } catch {}
    }

    private database(): Promise<IDBDatabase> {
        if (this.databasePromise) return this.databasePromise

        this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                    request.result.createObjectStore(STORE_NAME)
                }
            }
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
            request.onblocked = () => reject(new Error('IndexedDB cache is blocked'))
        })

        return this.databasePromise
    }
}

let cacheStore: CacheStore | null = null

/** @internal Returns the cache store appropriate for the current runtime. */
export function getCacheStore(): CacheStore {
    if (cacheStore) return cacheStore
    cacheStore = typeof indexedDB === 'undefined'
        ? new MemoryCacheStore()
        : new IndexedDBCacheStore()
    return cacheStore
}
