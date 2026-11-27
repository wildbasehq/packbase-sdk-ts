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
    /** The feed page number, or a theme's page name: only a number pages. */
    page: number | string
}

/** The rows a search returns for a take: 50 when absent or below 1, at most 200. */
export function clampTake(take: unknown): number {
    if (typeof take !== 'number' || take < 1) return 50
    return Math.min(200, Math.floor(take))
}

/**
 * The `query.run` host tool, the same wherever a program runs. The paged query gets the
 * page's window and reports whether rows follow it; every other query runs as built, under
 * the reader's rating preference.
 */
export function queryHost(options: QueryHostOptions): { tool: HostTool; hasMore(): boolean } {
    let more = false
    const tool: HostTool = async (inputs, params) => {
        const query = inputs.query as Record<string, unknown>
        if (params.paged !== true || typeof options.page !== 'number') return options.execute(query, { readerRatings: true })
        const take = clampTake(query.take)
        const rows = await options.execute({ ...query, feed: true, take, skip: (options.page - 1) * take }, { extraRow: true })
        if (!Array.isArray(rows) || rows.length <= take) return rows
        more = true
        return rows.slice(0, take)
    }
    return { tool, hasMore: () => more }
}
