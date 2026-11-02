export type FeedQueryValue = string | number | boolean | null | FeedQueryValue[] | { [key: string]: FeedQueryValue }

/** The sanitized caller query that selected the page; excludes internal visibility predicates. */
export interface FeedSearchQuery {
  where: { [field: string]: FeedQueryValue }
  order_by: Array<{ field: string; direction: "asc" | "desc" }>
  context: "feed" | "direct"
  /** Display identities already visible in this response, keyed by their IDs. */
  labels?: { members: Record<string, string>; packs: Record<string, string> }
}

/** Viewer-specific provenance from the selection query, never from hydrated content. */
export interface FeedExplanation {
  query?: FeedSearchQuery
  version: 1
  source: "following" | "gossip" | "pack" | "profile" | "tag" | "everything" | "search"
  order: "newest_first" | "oldest_first" | "recent_activity" | "pinned" | "query_order"
  signals: Array<"followed_member" | "own_post" | "joined_pack" | "followed_tag" | "network_activity" | "pinned">
  filters: Array<"safe_only" | "blocked_tags" | "media_only">
  sort_signal?: "interaction_time" | "publication_time"
}
