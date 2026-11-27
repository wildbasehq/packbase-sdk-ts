import type { HostTool } from './run'

export interface QueryExecuteOptions {
    /** Fetch one row past the take, so the caller can tell whether there are more. */
    extraRow?: boolean
    /** Apply the reader's rating preference, as `feed: true` does, without feed explanations. */
    readerRatings?: boolean
}

export interface QueryHostOptions {
    /** Runs one search query as the reader. */
    execute(query: Record<string, unknown>, options: QueryExecuteOptions): Promise<unknown>
}

/** The rows a search returns for a take: 50 when absent or below 1, at most 200. */
export function clampTake(take: unknown): number {
    if (typeof take !== 'number' || take < 1) return 50
    return Math.min(200, Math.floor(take))
}

/**
 * The `query.run` host tool, the same wherever a program runs. A query that was given a page
 * gets that page's window and reports whether rows follow it; every other query runs as
 * built, under the reader's rating preference.
 */
export function queryHost(options: QueryHostOptions): { tool: HostTool; hasMore(): boolean } {
    let more = false
    const tool: HostTool = async (inputs) => {
        const { page, ...query } = inputs.query as Record<string, unknown>
        if (typeof page !== 'number') return options.execute(query, { readerRatings: true })
        const take = clampTake(query.take)
        const skip = (Math.max(1, Math.floor(page)) - 1) * take
        const rows = await options.execute({ ...query, feed: true, take, skip }, { extraRow: true })
        if (!Array.isArray(rows) || rows.length <= take) return rows
        more = true
        return rows.slice(0, take)
    }
    return { tool, hasMore: () => more }
}
