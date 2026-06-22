import { DEFAULT_MAX_SITEMAPS, DEFAULT_MAX_SITEMAP_URLS, DEFAULT_USER_AGENT } from "./defaults.js";
import { normalizeUrl } from "./urlUtils.js";

export type SitemapDocumentType = "index" | "urlset" | "unknown";

export function detectSitemapDocumentType(xml: string): SitemapDocumentType {
  if (/<sitemapindex[\s>]/i.test(xml)) return "index";
  if (/<urlset[\s>]/i.test(xml)) return "urlset";
  return "unknown";
}

export function extractSitemapLocValues(xml: string): string[] {
  const values: string[] = [];
  const locRegex = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    const locValue = (match[1] ?? "").trim();
    if (locValue) values.push(locValue);
  }

  return values;
}

export function canonicalSiteHostname(hostname: string): string {
  return hostname.toLowerCase().startsWith("www.") ? hostname.slice(4).toLowerCase() : hostname.toLowerCase();
}

export function isRelatedSiteUrl(url: string, siteOrigin: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url));
    const site = new URL(siteOrigin);
    return canonicalSiteHostname(parsed.hostname) === canonicalSiteHostname(site.hostname);
  } catch {
    return false;
  }
}

function looksLikeSitemapFile(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".xml") && pathname.includes("sitemap");
  } catch {
    return false;
  }
}

export function processSitemapLocations(
  xml: string,
  siteOrigin: string,
  visitedSitemaps: Set<string>,
  pageUrls: Set<string>,
  sitemapQueue: string[]
): void {
  const docType = detectSitemapDocumentType(xml);
  const locs = extractSitemapLocValues(xml);

  for (const locValue of locs) {
    try {
      const normalizedLoc = normalizeUrl(locValue);
      if (!isRelatedSiteUrl(normalizedLoc, siteOrigin)) continue;

      if (docType === "index") {
        if (!visitedSitemaps.has(normalizedLoc)) {
          sitemapQueue.push(normalizedLoc);
        }
        continue;
      }

      if (docType === "urlset") {
        pageUrls.add(normalizedLoc);
        continue;
      }

      if (looksLikeSitemapFile(normalizedLoc) && !visitedSitemaps.has(normalizedLoc)) {
        sitemapQueue.push(normalizedLoc);
      } else {
        pageUrls.add(normalizedLoc);
      }
    } catch {
      // Ignore malformed loc values.
    }
  }
}

export async function collectUrlsFromSitemap(sitemapUrl: string, origin: string, timeoutMs: number): Promise<Set<string>> {
  const urls = new Set<string>();
  const visitedSitemaps = new Set<string>();
  const queue = [normalizeUrl(sitemapUrl)];

  while (
    queue.length > 0 &&
    visitedSitemaps.size < DEFAULT_MAX_SITEMAPS &&
    urls.size < DEFAULT_MAX_SITEMAP_URLS
  ) {
    const currentSitemap = queue.shift();
    if (!currentSitemap || visitedSitemaps.has(currentSitemap)) continue;
    visitedSitemaps.add(currentSitemap);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(currentSitemap, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": DEFAULT_USER_AGENT,
        },
      });
      clearTimeout(timeout);

      if (!response.ok) continue;
      const text = await response.text();
      processSitemapLocations(text, origin, visitedSitemaps, urls, queue);
    } catch {
      // Ignore sitemap fetch errors and continue.
    }
  }

  return urls;
}
