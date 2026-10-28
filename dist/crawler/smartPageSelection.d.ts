/**
 * Smart crawl URL selection based on URL-tree shape (not slug names).
 *
 * A "list" parent is a path with many direct children that are mostly leaves
 * (no further subpages) — typical for archives like news/events/blog, whatever
 * they are named. Within --max-pages we keep structural pages and sample
 * leaves under each list parent.
 */
export type UrlKind = "home" | "root" | "list" | "detail" | "other";
export type ClassifiedUrl = {
    url: string;
    kind: UrlKind;
    /** Pathname of the list parent when kind is list/detail, e.g. "/stories". */
    section: string | null;
    /** Sort priority (higher = sooner). */
    priority: number;
};
export type UrlTreeAnalysis = {
    /** Pathnames that look like list indexes (many leaf children). */
    listParents: ReadonlySet<string>;
    /** Origin used to rebuild URLs from pathnames when needed. */
    origin: string;
};
/** Minimum direct leaf children before a path is treated as a list parent. */
export declare const DEFAULT_LIST_MIN_CHILDREN = 8;
/** Share of direct children that must be leaves to count as a list. */
export declare const DEFAULT_LIST_LEAF_RATIO = 0.7;
export declare function pathSegments(urlOrPath: string): string[];
export declare function pathnameOf(urlString: string): string;
/** Parent pathname: `/a/b` → `/a`, `/a` → `/`, `/` → null. */
export declare function parentPathname(pathname: string): string | null;
/**
 * Build parent → direct children maps from a URL set and detect list parents:
 * paths with many children that are mostly leaves (no further children in the set).
 */
export declare function analyzeUrlTree(urls: string[], options?: {
    startUrl?: string;
    listMinChildren?: number;
    listLeafRatio?: number;
}): UrlTreeAnalysis;
/** Closest list-parent pathname for this path, or null. */
export declare function listParentForPathname(pathname: string, listParents: ReadonlySet<string>): string | null;
export declare function classifyCrawlUrl(urlString: string, tree: UrlTreeAnalysis): ClassifiedUrl;
export declare function crawlRequestPriority(urlString: string, tree: UrlTreeAnalysis): number;
/**
 * Soft per-list-parent cap for detail URLs discovered during a crawl.
 * Structural pages (home/root/list) are never capped this way.
 */
export declare function detailCapPerSection(maxPages: number, listParentCount?: number): number;
/**
 * Pick up to `maxPages` URLs using URL-tree shape: keep home/root/list pages,
 * then round-robin a sample of leaf details under each detected list parent.
 */
export declare function selectSmartCrawlUrls(urls: string[], maxPages: number, options?: {
    startUrl?: string;
    listMinChildren?: number;
    listLeafRatio?: number;
}): {
    urls: string[];
    tree: UrlTreeAnalysis;
};
/** Sort URLs by crawl priority (desc), stable for equal priority. */
export declare function sortByCrawlPriority(urls: string[], tree: UrlTreeAnalysis): string[];
/**
 * Tracks list parents during a live crawl: uses seed analysis up front, and
 * promotes parents to "list" when enough leaf-like children are observed.
 */
export declare function createDiscoveryGate(seedUrls: string[], maxPages: number, options?: {
    listMinChildren?: number;
    listLeafRatio?: number;
}): {
    tree: UrlTreeAnalysis;
    allowEnqueue: (url: string) => boolean;
    remember: (url: string) => void;
    isStructural: (url: string) => boolean;
};
//# sourceMappingURL=smartPageSelection.d.ts.map