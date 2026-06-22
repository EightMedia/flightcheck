#!/usr/bin/env node

import { Command } from "commander";
import { runChecks } from "./checks/runner.js";
import { DEFAULT_CHECK_IDS, type CheckId } from "./checks/types.js";
import {
  DEFAULT_BURST_DELAY_MS,
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
  DEFAULT_MAX_PAGES,
  DEFAULT_TIMEOUT_MS,
} from "./crawler/defaults.js";
import { buildDefaultOutputPaths } from "./crawler/outputPaths.js";
import { isHttpUrl, normalizeUrl, parseExcludePatterns } from "./crawler/urlUtils.js";

async function main(): Promise<void> {
  const sanitizedArgv = [...process.argv];
  const separatorIndex = sanitizedArgv.indexOf("--");
  if (separatorIndex >= 2) {
    sanitizedArgv.splice(separatorIndex, 1);
  }

  const program = new Command();

  program
    .name("flightcheck")
    .description("Crawl a website and generate JSON + Markdown TODO reports.")
    .argument("<startUrl>", "Start URL for the crawl")
    .option("--output <file>", "Output JSON file path")
    .option("--report <file>", "Output Markdown TODO report path")
    .option("--json-only", "Skip Markdown TODO report generation", false)
    .option("--errors-only", "Include only records with errors or missing attributes in the report", false)
    .option("--parallel", "Run independent checks in parallel", false)
    .option("--checks <ids>", "Comma-separated checks to run (crawl,analyze,lighthouse,security-headers,dns,robots-txt,sitemap)")
    .option("--max-pages <n>", "Maximum number of pages", String(DEFAULT_MAX_PAGES))
    .option("--delay-ms <n>", "Delay between requests in ms", String(DEFAULT_DELAY_MS))
    .option("--timeout-ms <n>", "Request timeout in ms", String(DEFAULT_TIMEOUT_MS))
    .option("--concurrency <n>", "Maximum concurrent requests", String(DEFAULT_CONCURRENCY))
    .option("--burst-delay-ms <n>", "Pause after each burst in ms", String(DEFAULT_BURST_DELAY_MS))
    .option("--sitemap-start", "Seed crawl with sitemap URLs", false)
    .option("--sitemap-url <url>", "Custom sitemap URL")
    .option("--respect-robots-txt", "Respect robots.txt disallow rules", false)
    .option("--quiet", "Suppress Crawlee info/statistics logs (only warnings and errors)", false)
    .option("--exclude <patterns>", "Exclude patterns (comma-separated, repeatable)", (value, acc: string[]) => {
      acc.push(value);
      return acc;
    }, [])
    .option("--only <groups>", "Run only these check groups (comma-separated): meta,icons,social,tracking,security")
    .option("--skip <groups>", "Skip these check groups (comma-separated)")
    .option("--reveal-secrets", "Show full secret values instead of masked ones", false)
    .action(async (startUrl: string, opts) => {
      if (!isHttpUrl(startUrl)) {
        throw new Error("<start-url> must be a valid http(s) URL.");
      }

      const normalizedStartUrl = normalizeUrl(startUrl);
      const defaultPaths = buildDefaultOutputPaths(normalizedStartUrl);
      const outputPath = opts.output as string | undefined;
      const reportPath = opts.report as string | undefined;
      const jsonOnly = Boolean(opts.jsonOnly);
      const errorsOnly = Boolean(opts.errorsOnly);
      const checks: CheckId[] = opts.checks
        ? (opts.checks as string).split(",").map((value) => value.trim()).filter(Boolean) as CheckId[]
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
          sitemapStart: opts.sitemapStart as boolean,
          sitemapUrl: opts.sitemapUrl as string | undefined,
          excludePatterns: parseExcludePatterns(opts.exclude as string[]),
          respectRobotsTxt: opts.respectRobotsTxt as boolean,
          only: opts.only as string | undefined,
          skip: opts.skip as string | undefined,
          revealSecrets: opts.revealSecrets as boolean,
          quiet: opts.quiet as boolean,
        },
        analyze: {
          reportPath: reportPath ?? defaultPaths.reportMd,
          errorsOnly,
        },
      });

      const crawlResult = outputs.crawl;
      const analyzeResult = outputs.analyze;
      const crawlFailure = results.find((result) => result.id === "crawl" && result.status === "failure");
      if (crawlFailure) {
        throw new Error(crawlFailure.error ?? "Crawl check failed.");
      }

      const summary: Record<string, unknown> = {
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
      }

      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    });

  await program.parseAsync(sanitizedArgv);
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
