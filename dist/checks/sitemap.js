import { DEFAULT_SITEMAP_URL_SUFFIX, DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT } from "../crawler/defaults.js";
import { collectUrlsFromSitemap } from "../crawler/sitemap.js";
import { matchesExcludePattern, normalizeUrl } from "../crawler/urlUtils.js";
import { issue } from "./issues.js";
const SITEMAP_URL_NOT_CRAWLED_TIP = "Probable cause: sitemap URLs must match crawled URLs exactly, including hostname (apex vs www). " +
    "These URLs were not crawled — check page limits, robots blocks, stale sitemap entries, or a failing sitemap regeneration job (cron).";
function filterComparableUrls(urls, excludePatterns) {
    const normalized = [...new Set(urls.map((url) => normalizeUrl(url)))];
    if (excludePatterns.length === 0)
        return normalized;
    return normalized.filter((url) => !matchesExcludePattern(url, excludePatterns));
}
export function analyzeSitemapCompare(input) {
    const threshold = input.mismatchThresholdPercent ?? 10;
    const excludePatterns = input.excludePatterns ?? [];
    const issues = [];
    for (const source of input.sources) {
        if (source.status === null || source.status >= 400) {
            issues.push(issue("sitemap-unreachable", "error", `Sitemap not reachable: ${source.url} (${source.status ?? "unreachable"}).`));
        }
    }
    const successfulSources = input.sources.filter((source) => source.status !== null && source.status >= 200 && source.status < 300);
    if (successfulSources.length === 0) {
        issues.push(issue("sitemap-missing", "error", "No sitemap found."));
        return {
            sources: input.sources,
            sitemapPageUrls: [],
            crawledUrls: filterComparableUrls(input.crawledUrls, excludePatterns),
            inSitemapNotCrawled: [],
            crawledNotInSitemap: [],
            mismatchPercent: 0,
            issues,
        };
    }
    const sitemapPageUrls = filterComparableUrls(successfulSources.flatMap((source) => source.pageUrls), excludePatterns);
    const crawledUrls = filterComparableUrls(input.crawledUrls, excludePatterns);
    if (sitemapPageUrls.length === 0) {
        issues.push(issue("sitemap-empty", "error", "Sitemap was reachable but contained no page URLs (check sitemap index nesting and host aliases such as apex vs www)."));
        return {
            sources: input.sources,
            sitemapPageUrls,
            crawledUrls,
            inSitemapNotCrawled: [],
            crawledNotInSitemap: crawledUrls,
            mismatchPercent: crawledUrls.length === 0 ? 0 : 100,
            issues,
        };
    }
    const sitemapSet = new Set(sitemapPageUrls);
    const crawledSet = new Set(crawledUrls);
    const inSitemapNotCrawled = sitemapPageUrls.filter((url) => !crawledSet.has(url));
    const crawledNotInSitemap = crawledUrls.filter((url) => !sitemapSet.has(url));
    if (inSitemapNotCrawled.length > 0) {
        issues.push(issue("sitemap-url-not-crawled", "critical", `${inSitemapNotCrawled.length} sitemap URL(s) were not crawled. ${SITEMAP_URL_NOT_CRAWLED_TIP}`));
    }
    if (crawledNotInSitemap.length > 0) {
        issues.push(issue("sitemap-missing-crawled-url", "critical", `${crawledNotInSitemap.length} crawled URL(s) are missing from the sitemap.`));
    }
    const total = new Set([...sitemapPageUrls, ...crawledUrls]).size;
    const mismatchCount = new Set([...inSitemapNotCrawled, ...crawledNotInSitemap]).size;
    const mismatchPercent = total === 0 ? 0 : (mismatchCount / total) * 100;
    if (mismatchPercent > threshold) {
        issues.push(issue("sitemap-mismatch-threshold", "critical", `Sitemap mismatch is ${mismatchPercent.toFixed(1)}% (threshold ${threshold}%). ` +
            "Sitemap URLs must match crawled URLs exactly, including hostname."));
    }
    return {
        sources: input.sources,
        sitemapPageUrls,
        crawledUrls,
        inSitemapNotCrawled,
        crawledNotInSitemap,
        mismatchPercent,
        issues,
    };
}
export function discoverSitemapCandidates(origin, robotsSitemapUrls = []) {
    const defaultSitemap = normalizeUrl(`${origin}${DEFAULT_SITEMAP_URL_SUFFIX}`);
    const candidates = [...robotsSitemapUrls.map((url) => normalizeUrl(url)), defaultSitemap];
    return [...new Set(candidates)];
}
async function probeSitemapStatus(url, timeoutMs) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
            redirect: "follow",
            signal: controller.signal,
            headers: { "user-agent": DEFAULT_USER_AGENT },
        });
        clearTimeout(timeout);
        return response.status;
    }
    catch {
        return null;
    }
}
export async function loadSitemapSources(candidateUrls, origin, timeoutMs) {
    const sources = [];
    for (const url of candidateUrls) {
        const status = await probeSitemapStatus(url, timeoutMs);
        if (status !== null && status >= 200 && status < 300) {
            const pageUrls = Array.from(await collectUrlsFromSitemap(url, origin, timeoutMs));
            sources.push({ url, status, pageUrls });
        }
        else {
            sources.push({ url, status, pageUrls: [] });
        }
    }
    return sources;
}
export async function runSitemapCheck(options) {
    const origin = new URL(normalizeUrl(options.startUrl)).origin;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const candidates = discoverSitemapCandidates(origin, options.robotsSitemapUrls);
    const sources = await loadSitemapSources(candidates, origin, timeoutMs);
    return analyzeSitemapCompare({
        sources,
        crawledUrls: options.crawledUrls,
        mismatchThresholdPercent: options.mismatchThresholdPercent,
        excludePatterns: options.excludePatterns,
    });
}
export async function collectSitemapPageUrls(startUrl, timeoutMs, robotsSitemapUrls = [], customSitemapUrl) {
    const origin = new URL(normalizeUrl(startUrl)).origin;
    const candidates = discoverSitemapCandidates(origin, robotsSitemapUrls);
    if (customSitemapUrl) {
        const normalized = normalizeUrl(customSitemapUrl);
        if (!candidates.includes(normalized)) {
            candidates.unshift(normalized);
        }
    }
    const pageUrls = new Set();
    for (const candidate of candidates) {
        const urls = await collectUrlsFromSitemap(candidate, origin, timeoutMs);
        for (const url of urls) {
            pageUrls.add(url);
        }
    }
    return [...pageUrls];
}
