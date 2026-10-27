#!/usr/bin/env node
import { Command } from "commander";
import { runChecks } from "./checks/runner.js";
import { DEFAULT_CHECK_IDS } from "./checks/types.js";
import { DEFAULT_BURST_DELAY_MS, DEFAULT_CONCURRENCY, DEFAULT_DELAY_MS, DEFAULT_MAX_PAGES, DEFAULT_TIMEOUT_MS, } from "./crawler/defaults.js";
import { buildDefaultOutputPaths } from "./crawler/outputPaths.js";
import { isHttpUrl, normalizeUrl, parseExcludePatterns } from "./crawler/urlUtils.js";
async function main() {
    const sanitizedArgv = [...process.argv];
    const separatorIndex = sanitizedArgv.indexOf("--");
    if (separatorIndex >= 2) {
        sanitizedArgv.splice(separatorIndex, 1);
    }
    const program = new Command();
    program
        .name("flightcheck")
        .description("Crawl a website and generate crawl JSON plus structured report JSON/Markdown.")
        .argument("<startUrl>", "Start URL for the crawl")
        .option("--output <file>", "Output crawl JSON file path")
        .option("--report <file>", "Output Markdown report path")
        .option("--json-only", "Skip analyze report generation", false)
        .option("--errors-only", "Include only critical/error findings in the Markdown report", false)
        .option("--parallel", "Run independent checks in parallel", false)
        .option("--checks <ids>", "Comma-separated checks to run (crawl,analyze,lighthouse,security-headers,dns,robots-txt,sitemap,agent-ready)")
        .option("--max-pages <n>", "Maximum number of pages", String(DEFAULT_MAX_PAGES))
        .option("--delay-ms <n>", "Delay between requests in ms", String(DEFAULT_DELAY_MS))
        .option("--timeout-ms <n>", "Request timeout in ms", String(DEFAULT_TIMEOUT_MS))
        .option("--concurrency <n>", "Maximum concurrent requests", String(DEFAULT_CONCURRENCY))
        .option("--burst-delay-ms <n>", "Pause after each burst in ms", String(DEFAULT_BURST_DELAY_MS))
        .option("--sitemap-start", "Seed crawl with sitemap URLs", false)
        .option("--sitemap-url <url>", "Custom sitemap URL")
        .option("--respect-robots-txt", "Respect robots.txt disallow rules", false)
        .option("--quiet", "Suppress Crawlee info/statistics logs (only warnings and errors)", false)
        .option("--exclude <patterns>", "Exclude patterns (comma-separated, repeatable)", (value, acc) => {
        acc.push(value);
        return acc;
    }, [])
        .option("--only <groups>", "Run only these check groups (comma-separated): meta,icons,social,tracking,stack,security,images,a11y-static")
        .option("--skip <groups>", "Skip these check groups (comma-separated)")
        .option("--reveal-secrets", "Show full secret values instead of masked ones", false)
        .action(async (startUrl, opts) => {
        if (!isHttpUrl(startUrl)) {
            throw new Error("<start-url> must be a valid http(s) URL.");
        }
        const normalizedStartUrl = normalizeUrl(startUrl);
        const defaultPaths = buildDefaultOutputPaths(normalizedStartUrl);
        const outputPath = opts.output;
        const reportPath = opts.report;
        const jsonOnly = Boolean(opts.jsonOnly);
        const errorsOnly = Boolean(opts.errorsOnly);
        const checks = opts.checks
            ? opts.checks.split(",").map((value) => value.trim()).filter(Boolean)
            : jsonOnly
                ? ["crawl"]
                : DEFAULT_CHECK_IDS;
        const { outputs, results } = await runChecks({
            startUrl: normalizedStartUrl,
            checks,
            parallel: Boolean(opts.parallel),
            crawl: {
                startUrl: normalizedStartUrl,
                outputPath: outputPath ?? defaultPaths.rawJson,
                maxPages: Number(opts.maxPages),
                delayMs: Number(opts.delayMs),
                timeoutMs: Number(opts.timeoutMs),
                concurrency: Number(opts.concurrency),
                burstDelayMs: Number(opts.burstDelayMs),
                sitemapStart: opts.sitemapStart,
                sitemapUrl: opts.sitemapUrl,
                excludePatterns: parseExcludePatterns(opts.exclude),
                respectRobotsTxt: opts.respectRobotsTxt,
                only: opts.only,
                skip: opts.skip,
                revealSecrets: opts.revealSecrets,
                quiet: opts.quiet,
            },
            analyze: {
                reportPath: reportPath ?? defaultPaths.reportMd,
                reportJsonPath: defaultPaths.reportJson,
                errorsOnly,
                siteUrl: normalizedStartUrl,
            },
        });
        const crawlResult = outputs.crawl;
        const analyzeResult = outputs.analyze;
        const crawlFailure = results.find((result) => result.id === "crawl" && result.status === "failure");
        if (crawlFailure) {
            throw new Error(crawlFailure.error ?? "Crawl check failed.");
        }
        const summary = {
            message: crawlResult?.interrupted ? "Flightcheck interrupted, partial reports written" : "Flightcheck reports written",
            redirectOnly: outputs.redirect?.redirectOnly ?? false,
            checks: results.map((result) => ({ id: result.id, status: result.status, durationMs: result.durationMs })),
        };
        if (outputs.redirect?.redirectOnly) {
            summary.redirect = {
                url: outputs.redirect.url,
                status: outputs.redirect.status,
                location: outputs.redirect.location,
                resolvedTarget: outputs.redirect.resolvedTarget,
                issues: outputs.redirect.issues.length,
            };
        }
        if (crawlResult) {
            summary.output = crawlResult.outputPath;
            summary.pages = crawlResult.records.length;
            summary.secretsFound = crawlResult.secretsFound;
            summary.interrupted = crawlResult.interrupted;
            if (crawlResult.secretsFound > 0 && !opts.revealSecrets) {
                summary.hint = `${crawlResult.secretsFound} secret(s) found (masked). Re-run with --reveal-secrets to show full values.`;
            }
        }
        if (analyzeResult) {
            summary.report = analyzeResult.reportPath;
            summary.reportJson = analyzeResult.reportJsonPath;
            summary.findings = analyzeResult.report.findings.length;
        }
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    });
    await program.parseAsync(sanitizedArgv);
}
main().catch((error) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
