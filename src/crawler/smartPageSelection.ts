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
export const DEFAULT_LIST_MIN_CHILDREN = 8;

/** Share of direct children that must be leaves to count as a list. */
export const DEFAULT_LIST_LEAF_RATIO = 0.7;

const PRIORITY: Record<UrlKind, number> = {
  home: 100,
  root: 80,
  list: 60,
  detail: 40,
  other: 20,
};

export function pathSegments(urlOrPath: string): string[] {
  try {
    const pathname = urlOrPath.includes("://") ? new URL(urlOrPath).pathname : urlOrPath;
    return pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

export function pathnameOf(urlString: string): string {
  try {
    const pathname = new URL(urlString).pathname;
    if (!pathname || pathname === "") return "/";
    return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  } catch {
    return "/";
  }
}

/** Parent pathname: `/a/b` → `/a`, `/a` → `/`, `/` → null. */
export function parentPathname(pathname: string): string | null {
  if (pathname === "/" || pathname === "") return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
}

function originOf(urls: string[], startUrl?: string): string {
  const candidate = startUrl ?? urls[0];
  if (!candidate) return "https://example.com";
  try {
    return new URL(candidate).origin;
  } catch {
    return "https://example.com";
  }
}

function uniqueUrls(urls: string[], startUrl?: string): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  if (startUrl) {
    unique.push(startUrl);
    seen.add(startUrl);
  }
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return unique;
}

/**
 * Build parent → direct children maps from a URL set and detect list parents:
 * paths with many children that are mostly leaves (no further children in the set).
 */
export function analyzeUrlTree(
  urls: string[],
  options?: {
    startUrl?: string;
    listMinChildren?: number;
    listLeafRatio?: number;
  }
): UrlTreeAnalysis {
  const minChildren = options?.listMinChildren ?? DEFAULT_LIST_MIN_CHILDREN;
  const leafRatio = options?.listLeafRatio ?? DEFAULT_LIST_LEAF_RATIO;
  const unique = uniqueUrls(urls, options?.startUrl);
  const origin = originOf(unique, options?.startUrl);

  const childrenOf = new Map<string, Set<string>>();
  const pathnames = new Set<string>();

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

  const isLeaf = (pathname: string): boolean => {
    const kids = childrenOf.get(pathname);
    return !kids || kids.size === 0;
  };

  const listParents = new Set<string>();
  for (const [parent, children] of childrenOf) {
    if (parent === "/") continue; // home fan-out is structural, not an archive list
    const childList = [...children];
    if (childList.length < minChildren) continue;
    const leafCount = childList.filter((child) => isLeaf(child)).length;
    if (leafCount >= minChildren && leafCount / childList.length >= leafRatio) {
      listParents.add(parent);
    }
  }

  return { listParents, origin };
}

/** Closest list-parent pathname for this path, or null. */
export function listParentForPathname(
  pathname: string,
  listParents: ReadonlySet<string>
): string | null {
  let current = parentPathname(pathname);
  while (current !== null) {
    if (listParents.has(current)) return current;
    current = parentPathname(current);
  }
  return null;
}

export function classifyCrawlUrl(urlString: string, tree: UrlTreeAnalysis): ClassifiedUrl {
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

export function crawlRequestPriority(urlString: string, tree: UrlTreeAnalysis): number {
  return classifyCrawlUrl(urlString, tree).priority;
}

/**
 * Soft per-list-parent cap for detail URLs discovered during a crawl.
 * Structural pages (home/root/list) are never capped this way.
 */
export function detailCapPerSection(maxPages: number, listParentCount = 8): number {
  const detailBudget = Math.max(8, Math.floor(maxPages * 0.5));
  const sections = Math.max(1, listParentCount);
  return Math.max(2, Math.floor(detailBudget / Math.min(sections, 8)));
}

/**
 * Pick up to `maxPages` URLs using URL-tree shape: keep home/root/list pages,
 * then round-robin a sample of leaf details under each detected list parent.
 */
export function selectSmartCrawlUrls(
  urls: string[],
  maxPages: number,
  options?: {
    startUrl?: string;
    listMinChildren?: number;
    listLeafRatio?: number;
  }
): { urls: string[]; tree: UrlTreeAnalysis } {
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
  const home: ClassifiedUrl[] = [];
  const roots: ClassifiedUrl[] = [];
  const lists: ClassifiedUrl[] = [];
  const others: ClassifiedUrl[] = [];
  const detailsBySection = new Map<string, ClassifiedUrl[]>();

  for (const item of classified) {
    if (item.kind === "home") home.push(item);
    else if (item.kind === "root") roots.push(item);
    else if (item.kind === "list") lists.push(item);
    else if (item.kind === "detail") {
      const key = item.section ?? "_";
      const bucket = detailsBySection.get(key) ?? [];
      bucket.push(item);
      detailsBySection.set(key, bucket);
    } else others.push(item);
  }

  const selected: string[] = [];
  const selectedSet = new Set<string>();

  const take = (items: ClassifiedUrl[]): void => {
    for (const item of items) {
      if (selected.length >= limit) return;
      if (selectedSet.has(item.url)) continue;
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
      if (selected.length >= limit) break;
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (selectedSet.has(next.url)) continue;
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
export function sortByCrawlPriority(urls: string[], tree: UrlTreeAnalysis): string[] {
  return urls
    .map((url, index) => ({ url, index, priority: crawlRequestPriority(url, tree) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map((row) => row.url);
}

/**
 * Tracks list parents during a live crawl: uses seed analysis up front, and
 * promotes parents to "list" when enough leaf-like children are observed.
 */
export function createDiscoveryGate(
  seedUrls: string[],
  maxPages: number,
  options?: { listMinChildren?: number; listLeafRatio?: number }
): {
  tree: UrlTreeAnalysis;
  allowEnqueue: (url: string) => boolean;
  remember: (url: string) => void;
  isStructural: (url: string) => boolean;
} {
  const minChildren = options?.listMinChildren ?? DEFAULT_LIST_MIN_CHILDREN;
  const leafRatio = options?.listLeafRatio ?? DEFAULT_LIST_LEAF_RATIO;
  const tree = analyzeUrlTree(seedUrls, options);
  const listParents = new Set(tree.listParents);
  const childrenOf = new Map<string, Set<string>>();
  const known = new Set<string>();
  const detailCounts = new Map<string, number>();

  const register = (url: string): void => {
    const pathname = pathnameOf(url);
    if (known.has(pathname)) return;
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

  for (const seed of seedUrls) register(seed);

  const liveTree = (): UrlTreeAnalysis => ({ listParents, origin: tree.origin });

  const capFor = (): number => detailCapPerSection(maxPages, Math.max(1, listParents.size));

  return {
    get tree() {
      return liveTree();
    },
    allowEnqueue(url: string): boolean {
      const pathname = pathnameOf(url);
      const parent = listParentForPathname(pathname, listParents);
      if (!parent) return true;
      return (detailCounts.get(parent) ?? 0) < capFor();
    },
    remember(url: string): void {
      register(url);
      const classified = classifyCrawlUrl(url, liveTree());
      if (classified.kind !== "detail" || !classified.section) return;
      detailCounts.set(classified.section, (detailCounts.get(classified.section) ?? 0) + 1);
    },
    isStructural(url: string): boolean {
      const kind = classifyCrawlUrl(url, liveTree()).kind;
      return kind === "home" || kind === "root" || kind === "list";
    },
  };
}
