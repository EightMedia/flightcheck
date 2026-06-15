#!/usr/bin/env node
import { Command } from "commander";
import { DEFAULT_BURST_DELAY_MS, DEFAULT_CONCURRENCY, DEFAULT_DELAY_MS, DEFAULT_MAX_PAGES, DEFAULT_OUTPUT_PATH, DEFAULT_SITEMAP_URL_SUFFIX, DEFAULT_TIMEOUT_MS, } from "./crawler/defaults.js";
import { resolveActiveGroups } from "./crawler/checkGroups.js";
import { runCrawler } from "./crawler/runCrawler.js";
import { collectUrlsFromSitemap } from "./crawler/sitemap.js";
import { isHttpUrl, matchesExcludePattern, normalizeUrl, parseExcludePatterns } from "./crawler/urlUtils.js";
async function main() {
    const sanitizedArgv = [...process.argv];
    const separatorIndex = sanitizedArgv.indexOf("--");
    if (separatorIndex >= 2) {
        sanitizedArgv.splice(separatorIndex, 1);
    }
    const program = new Command();
    program
        .name("flightcheck")
        .description("Crawl a website and output verification report as JSON.")
        .argument("<startUrl>", "Start URL for the crawl")
        .option("--output <file>", "Output JSON file path", DEFAULT_OUTPUT_PATH)
        .option("--max-pages <n>", "Maximum number of pages", String(DEFAULT_MAX_PAGES))
        .option("--delay-ms <n>", "Delay between requests in ms", String(DEFAULT_DELAY_MS))
        .option("--timeout-ms <n>", "Request timeout in ms", String(DEFAULT_TIMEOUT_MS))
        .option("--concurrency <n>", "Maximum concurrent requests", String(DEFAULT_CONCURRENCY))
        .option("--burst-delay-ms <n>", "Pause after each burst in ms", String(DEFAULT_BURST_DELAY_MS))
        .option("--sitemap-start", "Seed crawl with sitemap URLs", false)
        .option("--sitemap-url <url>", "Custom sitemap URL")
        .option("--respect-robots-txt", "Respect robots.txt disallow rules", false)
        .option("--exclude <patterns>", "Exclude patterns (comma-separated, repeatable)", (value, acc) => {
        acc.push(value);
        return acc;
    }, [])
        .option("--only <groups>", "Run only these check groups (comma-separated): meta,icons,social,tracking,security")
        .option("--skip <groups>", "Skip these check groups (comma-separated)")
        .option("--reveal-secrets", "Show full secret values instead of masked ones", false)
        .action(async (startUrl, opts) => {
        if (!isHttpUrl(startUrl)) {
            throw new Error("<start-url> must be a valid http(s) URL.");
        }
        const maxPages = Number(opts.maxPages);
        const delayMs = Number(opts.delayMs);
        const timeoutMs = Number(opts.timeoutMs);
        const concurrency = Number(opts.concurrency);
        const burstDelayMs = Number(opts.burstDelayMs);
        const outputPath = opts.output;
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
        let activeGroups;
        try {
            activeGroups = resolveActiveGroups({ only: opts.only, skip: opts.skip });
        }
        catch (error) {
            throw new Error(error instanceof Error ? error.message : String(error));
        }
        const revealSecrets = Boolean(opts.revealSecrets);
        const normalizedStartUrl = normalizeUrl(startUrl);
        const origin = new URL(normalizedStartUrl).origin;
        const excludePatterns = parseExcludePatterns(opts.exclude);
        const sitemapUrl = opts.sitemapUrl ?? `${origin}${DEFAULT_SITEMAP_URL_SUFFIX}`;
        let seedUrls = [normalizedStartUrl];
        if (opts.sitemapStart) {
            const sitemapUrls = await collectUrlsFromSitemap(sitemapUrl, origin, timeoutMs);
            seedUrls = Array.from(sitemapUrls);
            if (!seedUrls.includes(normalizedStartUrl)) {
                seedUrls.unshift(normalizedStartUrl);
            }
        }
        seedUrls = seedUrls.filter((url) => !matchesExcludePattern(url, excludePatterns));
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
            respectRobotsTxt: opts.respectRobotsTxt,
            activeGroups,
            revealSecrets,
        });
        const totalSecrets = records.reduce((sum, record) => sum + (record.security?.secrets.length ?? 0), 0);
        const summary = {
            message: interrupted ? "H1 crawl interrupted, partial report written" : "H1 crawl report written",
            output: outputPath,
            pages: records.length,
            secretsFound: totalSecrets,
            interrupted,
        };
        if (totalSecrets > 0 && !revealSecrets) {
            summary.hint = `${totalSecrets} secret(s) found (masked). Re-run with --reveal-secrets to show full values.`;
        }
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    });
    await program.parseAsync(sanitizedArgv);
}
main().catch((error) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
