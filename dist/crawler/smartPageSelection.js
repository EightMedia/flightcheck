/**
 * Smart crawl URL selection based on URL-tree shape (not slug names).
 *
 * A "list" parent is a path with many direct children that are mostly leaves
 * (no further subpages) — typical for archives like news/events/blog, whatever
 * they are named. Within --max-pages we keep structural pages and sample
 * leaves under each list parent.
 */
/** Minimum direct leaf children before a path is treated as a list parent. */
export const DEFAULT_LIST_MIN_CHILDREN = 8;
/** Share of direct children that must be leaves to count as a list. */
export const DEFAULT_LIST_LEAF_RATIO = 0.7;
const PRIORITY = {
    home: 100,
    root: 80,
    list: 60,
    detail: 40,
    other: 20,
};
export function pathSegments(urlOrPath) {
    try {
        const pathname = urlOrPath.includes("://") ? new URL(urlOrPath).pathname : urlOrPath;
        return pathname.split("/").filter(Boolean);
    }
    catch {
        return [];
    }
}
export function pathnameOf(urlString) {
    try {
        const pathname = new URL(urlString).pathname;
        if (!pathname || pathname === "")
            return "/";
        return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    }
    catch {
        return "/";
    }
}
/** Parent pathname: `/a/b` → `/a`, `/a` → `/`, `/` → null. */
export function parentPathname(pathname) {
    if (pathname === "/" || pathname === "")
        return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 1)
        return "/";
    return `/${segments.slice(0, -1).join("/")}`;
}
function originOf(urls, startUrl) {
    const candidate = startUrl ?? urls[0];
    if (!candidate)
        return "https://example.com";
    try {
        return new URL(candidate).origin;
    }
    catch {
        return "https://example.com";
    }
}
function uniqueUrls(urls, startUrl) {
    const seen = new Set();
    const unique = [];
    if (startUrl) {
        unique.push(startUrl);
        seen.add(startUrl);
    }
    for (const url of urls) {
        if (seen.has(url))
            continue;
        seen.add(url);
        unique.push(url);
    }
    return unique;
}
/**
 * Build parent → direct children maps from a URL set and detect list parents:
 * paths with many children that are mostly leaves (no further children in the set).
 */
export function analyzeUrlTree(urls, options) {
    const minChildren = options?.listMinChildren ?? DEFAULT_LIST_MIN_CHILDREN;
    const leafRatio = options?.listLeafRatio ?? DEFAULT_LIST_LEAF_RATIO;
    const unique = uniqueUrls(urls, options?.startUrl);
    const origin = originOf(unique, options?.startUrl);
    const childrenOf = new Map();
    const pathnames = new Set();
    for (const url of unique) {
        const pathname = pathnameOf(url);
        pathnames.add(pathname);
        let child = pathname;
        let parent = parentPathname(child);
        while (parent !== null) {
            let bucket = childrenOf.get(parent);
            if (!bucket) {
                bucket = new Set();
                childrenOf.set(parent, bucket);
            }
            bucket.add(child);
            child = parent;
            parent = parentPathname(child);
        }
    }
    const isLeaf = (pathname) => {
        const kids = childrenOf.get(pathname);
        return !kids || kids.size === 0;
    };
    const listParents = new Set();
    for (const [parent, children] of childrenOf) {
        if (parent === "/")
            continue; // home fan-out is structural, not an archive list
        const childList = [...children];
        if (childList.length < minChildren)
            continue;
        const leafCount = childList.filter((child) => isLeaf(child)).length;
        if (leafCount >= minChildren && leafCount / childList.length >= leafRatio) {
            listParents.add(parent);
        }
    }
    return { listParents, origin };
}
/** Closest list-parent pathname for this path, or null. */
export function listParentForPathname(pathname, listParents) {
    let current = parentPathname(pathname);
    while (current !== null) {
        if (listParents.has(current))
            return current;
        current = parentPathname(current);
    }
    return null;
}
export function classifyCrawlUrl(urlString, tree) {
    const pathname = pathnameOf(urlString);
    if (pathname === "/") {
        return { url: urlString, kind: "home", section: null, priority: PRIORITY.home };
    }
    if (tree.listParents.has(pathname)) {
        return { url: urlString, kind: "list", section: pathname, priority: PRIORITY.list };
    }
    const listParent = listParentForPathname(pathname, tree.listParents);
    if (listParent) {
        return { url: urlString, kind: "detail", section: listParent, priority: PRIORITY.detail };
    }
    const depth = pathSegments(pathname).length;
    if (depth <= 2) {
        return { url: urlString, kind: "root", section: null, priority: PRIORITY.root - (depth - 1) * 5 };
    }
    return { url: urlString, kind: "other", section: null, priority: PRIORITY.other };
}
export function crawlRequestPriority(urlString, tree) {
    return classifyCrawlUrl(urlString, tree).priority;
}
/**
 * Soft per-list-parent cap for detail URLs discovered during a crawl.
 * Structural pages (home/root/list) are never capped this way.
 */
export function detailCapPerSection(maxPages, listParentCount = 8) {
    const detailBudget = Math.max(8, Math.floor(maxPages * 0.5));
    const sections = Math.max(1, listParentCount);
    return Math.max(2, Math.floor(detailBudget / Math.min(sections, 8)));
}
/**
 * Pick up to `maxPages` URLs using URL-tree shape: keep home/root/list pages,
 * then round-robin a sample of leaf details under each detected list parent.
 */
export function selectSmartCrawlUrls(urls, maxPages, options) {
    if (!Number.isFinite(maxPages) || maxPages <= 0) {
        return { urls: [], tree: analyzeUrlTree([], options) };
    }
    const limit = Math.floor(maxPages);
    const unique = uniqueUrls(urls, options?.startUrl);
    const tree = analyzeUrlTree(unique, options);
    if (unique.length <= limit) {
        return { urls: sortByCrawlPriority(unique, tree), tree };
    }
    const classified = unique.map((url) => classifyCrawlUrl(url, tree));
    const home = [];
    const roots = [];
    const lists = [];
    const others = [];
    const detailsBySection = new Map();
    for (const item of classified) {
        if (item.kind === "home")
            home.push(item);
        else if (item.kind === "root")
            roots.push(item);
        else if (item.kind === "list")
            lists.push(item);
        else if (item.kind === "detail") {
            const key = item.section ?? "_";
            const bucket = detailsBySection.get(key) ?? [];
            bucket.push(item);
            detailsBySection.set(key, bucket);
        }
        else
            others.push(item);
    }
    const selected = [];
    const selectedSet = new Set();
    const take = (items) => {
        for (const item of items) {
            if (selected.length >= limit)
                return;
            if (selectedSet.has(item.url))
                continue;
            selected.push(item.url);
            selectedSet.add(item.url);
        }
    };
    take(home);
    take(roots);
    take(lists);
    const sectionQueues = [...detailsBySection.values()].map((bucket) => [...bucket]);
    let progress = true;
    while (selected.length < limit && progress) {
        progress = false;
        for (const queue of sectionQueues) {
            if (selected.length >= limit)
                break;
            while (queue.length > 0) {
                const next = queue.shift();
                if (selectedSet.has(next.url))
                    continue;
                selected.push(next.url);
                selectedSet.add(next.url);
                progress = true;
                break;
            }
        }
    }
    take(others);
    return { urls: selected, tree };
}
/** Sort URLs by crawl priority (desc), stable for equal priority. */
export function sortByCrawlPriority(urls, tree) {
    return urls
        .map((url, index) => ({ url, index, priority: crawlRequestPriority(url, tree) }))
        .sort((a, b) => b.priority - a.priority || a.index - b.index)
        .map((row) => row.url);
}
/**
 * Tracks list parents during a live crawl: uses seed analysis up front, and
 * promotes parents to "list" when enough leaf-like children are observed.
 */
export function createDiscoveryGate(seedUrls, maxPages, options) {
    const minChildren = options?.listMinChildren ?? DEFAULT_LIST_MIN_CHILDREN;
    const leafRatio = options?.listLeafRatio ?? DEFAULT_LIST_LEAF_RATIO;
    const tree = analyzeUrlTree(seedUrls, options);
    const listParents = new Set(tree.listParents);
    const childrenOf = new Map();
    const known = new Set();
    const detailCounts = new Map();
    const register = (url) => {
        const pathname = pathnameOf(url);
        if (known.has(pathname))
            return;
        known.add(pathname);
        let child = pathname;
        let parent = parentPathname(child);
        while (parent !== null) {
            let bucket = childrenOf.get(parent);
            if (!bucket) {
                bucket = new Set();
                childrenOf.set(parent, bucket);
            }
            bucket.add(child);
            if (parent !== "/") {
                const childList = [...bucket];
                if (childList.length >= minChildren) {
                    const leafCount = childList.filter((c) => {
                        const grand = childrenOf.get(c);
                        return !grand || grand.size === 0;
                    }).length;
                    if (leafCount >= minChildren && leafCount / childList.length >= leafRatio) {
                        listParents.add(parent);
                    }
                }
            }
            child = parent;
            parent = parentPathname(child);
        }
    };
    for (const seed of seedUrls)
        register(seed);
    const liveTree = () => ({ listParents, origin: tree.origin });
    const capFor = () => detailCapPerSection(maxPages, Math.max(1, listParents.size));
    return {
        get tree() {
            return liveTree();
        },
        allowEnqueue(url) {
            const pathname = pathnameOf(url);
            const parent = listParentForPathname(pathname, listParents);
            if (!parent)
                return true;
            return (detailCounts.get(parent) ?? 0) < capFor();
        },
        remember(url) {
            register(url);
            const classified = classifyCrawlUrl(url, liveTree());
            if (classified.kind !== "detail" || !classified.section)
                return;
            detailCounts.set(classified.section, (detailCounts.get(classified.section) ?? 0) + 1);
        },
        isStructural(url) {
            const kind = classifyCrawlUrl(url, liveTree()).kind;
            return kind === "home" || kind === "root" || kind === "list";
        },
    };
}
