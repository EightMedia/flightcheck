import { DEFAULT_BURST_DELAY_MS, DEFAULT_CONCURRENCY, DEFAULT_DELAY_MS, DEFAULT_MAX_PAGES, DEFAULT_TIMEOUT_MS, } from "../crawler/defaults.js";
import { resolveActiveGroups } from "../crawler/checkGroups.js";
import { buildDefaultOutputPaths } from "../crawler/outputPaths.js";
import { runCrawler } from "../crawler/runCrawler.js";
import { collectSitemapPageUrls } from "./sitemap.js";
import { isHttpUrl, matchesExcludePattern, normalizeUrl } from "../crawler/urlUtils.js";
export async function prepareCrawlSeedUrls(options) {
    if (!isHttpUrl(options.startUrl)) {
        throw new Error("<start-url> must be a valid http(s) URL.");
    }
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    const burstDelayMs = options.burstDelayMs ?? DEFAULT_BURST_DELAY_MS;
    if (!Number.isFinite(maxPages) || maxPages <= 0)
        throw new Error("--max-pages must be a positive number.");
    if (!Number.isFinite(delayMs) || delayMs < 0)
        throw new Error("--delay-ms must be zero or a positive number.");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
        throw new Error("--timeout-ms must be a positive number.");
    if (!Number.isFinite(concurrency) || concurrency <= 0)
        throw new Error("--concurrency must be a positive number.");
    if (!Number.isFinite(burstDelayMs) || burstDelayMs < 0) {
        throw new Error("--burst-delay-ms must be zero or a positive number.");
    }
    let activeGroups = options.activeGroups;
    if (!activeGroups) {
        try {
            activeGroups = resolveActiveGroups({ only: options.only, skip: options.skip });
        }
        catch (error) {
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }
    const normalizedStartUrl = normalizeUrl(options.startUrl);
    const defaultPaths = buildDefaultOutputPaths(normalizedStartUrl);
    const outputPath = options.outputPath ?? defaultPaths.rawJson;
    const excludePatterns = options.excludePatterns ?? [];
    const sitemapPageUrls = await collectSitemapPageUrls(normalizedStartUrl, timeoutMs, [], options.sitemapUrl);
    let seedUrls = [normalizedStartUrl];
    for (const url of sitemapPageUrls) {
        if (!seedUrls.includes(url)) {
            seedUrls.push(url);
        }
    }
    if (options.sitemapStart) {
        seedUrls = [...sitemapPageUrls];
        if (!seedUrls.includes(normalizedStartUrl)) {
            seedUrls.unshift(normalizedStartUrl);
        }
    }
    seedUrls = seedUrls.filter((url) => !matchesExcludePattern(url, excludePatterns));
    return { normalizedStartUrl, seedUrls, outputPath, activeGroups };
}
export async function runCrawlCheck(options) {
    const { normalizedStartUrl, seedUrls, outputPath, activeGroups } = await prepareCrawlSeedUrls(options);
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    const burstDelayMs = options.burstDelayMs ?? DEFAULT_BURST_DELAY_MS;
    const excludePatterns = options.excludePatterns ?? [];
    const { records, interrupted } = await runCrawler({
        startUrl: normalizedStartUrl,
        outputPath,
        maxPages: Math.floor(maxPages),
        delayMs: Math.floor(delayMs),
        timeoutMs: Math.floor(timeoutMs),
        concurrency: Math.floor(concurrency),
        burstDelayMs: Math.floor(burstDelayMs),
        seedUrls,
        excludePatterns,
        respectRobotsTxt: options.respectRobotsTxt ?? false,
        activeGroups,
        revealSecrets: options.revealSecrets ?? false,
        quiet: options.quiet ?? false,
    });
    const secretsFound = records.reduce((sum, record) => sum + (record.security?.secrets.length ?? 0), 0);
    return {
        records,
        outputPath,
        interrupted,
        secretsFound,
    };
}
