import { runAnalyzeCheck } from "./analyze.js";
import { runCrawlCheck } from "./crawl.js";
import { runDnsCheck } from "./dns.js";
import { runRobotsTxtCheck } from "./robots-txt.js";
import { runSecurityHeadersCheck } from "./security-headers.js";
import { runSitemapCheck } from "./sitemap.js";
import { normalizeUrl } from "../crawler/urlUtils.js";
import { CHECK_IDS, type CheckDefinition, type CheckExecutionResult, type CheckId, type CheckRunContext } from "./types.js";

export { CHECK_IDS };

export const CHECK_DEFINITIONS: Record<CheckId, CheckDefinition> = {
  crawl: {
    id: "crawl",
    name: "Crawl",
    description: "Crawl pages and collect SEO, metadata, tracking, and security verification data.",
    dependencies: [],
    implemented: true,
    run: async (context) => {
      const startedAt = Date.now();
      try {
        const data = await runCrawlCheck({
          startUrl: context.startUrl,
          ...context.options.crawl,
        });
        context.outputs.crawl = data;
        return {
          id: "crawl",
          status: "success",
          data,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: "crawl",
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        };
      }
    },
  },
  analyze: {
    id: "analyze",
    name: "Analyze",
    description: "Turn crawl JSON into an actionable Markdown TODO report.",
    dependencies: ["crawl"],
    implemented: true,
    run: async (context) => {
      const startedAt = Date.now();
      try {
        const crawlOutput = context.outputs.crawl;
        const redirectOnly = context.outputs.redirect?.redirectOnly ?? false;
        const data = await runAnalyzeCheck({
          ...context.options.analyze,
          records:
            context.options.analyze?.records ??
            crawlOutput?.records ??
            (redirectOnly ? [] : undefined),
          inputPath:
            context.options.analyze?.inputPath ??
            crawlOutput?.outputPath ??
            (redirectOnly ? "redirect-only.json" : undefined),
          reportPath: context.options.analyze?.reportPath,
          tier1: {
            redirect: context.outputs.redirect,
            securityHeaders: context.outputs.securityHeaders,
            dns: context.outputs.dns,
            robotsTxt: context.outputs.robotsTxt,
            sitemap: context.outputs.sitemap,
            ...context.options.analyze?.tier1,
          },
          redirectOnly,
        });
        context.outputs.analyze = data;
        return {
          id: "analyze",
          status: "success",
          data,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: "analyze",
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        };
      }
    },
  },
  lighthouse: {
    id: "lighthouse",
    name: "Lighthouse",
    description: "Run Lighthouse performance, accessibility, and best-practices audits.",
    dependencies: [],
    implemented: false,
    run: async () => ({
      id: "lighthouse",
      status: "unsupported",
      error: "Lighthouse check is not implemented yet.",
      durationMs: 0,
    }),
  },
  "security-headers": {
    id: "security-headers",
    name: "Security headers",
    description: "Verify HTTP security headers such as CSP, HSTS, and X-Frame-Options.",
    dependencies: [],
    implemented: true,
    run: async (context) => {
      const startedAt = Date.now();
      try {
        const data = await runSecurityHeadersCheck(context.startUrl);
        context.outputs.securityHeaders = data;
        return {
          id: "security-headers",
          status: "success",
          data,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: "security-headers",
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        };
      }
    },
  },
  dns: {
    id: "dns",
    name: "DNS ownership",
    description: "Verify DNS records and domain ownership signals.",
    dependencies: [],
    implemented: true,
    run: async (context) => {
      const startedAt = Date.now();
      try {
        const data = await runDnsCheck(context.startUrl);
        context.outputs.dns = data;
        return {
          id: "dns",
          status: "success",
          data,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: "dns",
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        };
      }
    },
  },
  "robots-txt": {
    id: "robots-txt",
    name: "Robots.txt",
    description: "Report robots.txt presence, sitemap directives, and crawl blocks.",
    dependencies: [],
    implemented: true,
    run: async (context) => {
      const startedAt = Date.now();
      try {
        const data = await runRobotsTxtCheck(context.startUrl);
        context.outputs.robotsTxt = data;
        return {
          id: "robots-txt",
          status: "success",
          data,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: "robots-txt",
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        };
      }
    },
  },
  sitemap: {
    id: "sitemap",
    name: "Sitemap",
    description: "Verify sitemap exists and matches crawled URLs.",
    dependencies: ["crawl"],
    implemented: true,
    run: async (context) => {
      const startedAt = Date.now();
      const crawlOutput = context.outputs.crawl;
      if (!crawlOutput) {
        return {
          id: "sitemap",
          status: "skipped",
          error: "Sitemap check requires crawl output.",
          durationMs: Date.now() - startedAt,
        };
      }

      try {
        const crawledUrls = crawlOutput.records.map((record) => normalizeUrl(record.url));
        const data = await runSitemapCheck({
          startUrl: context.startUrl,
          crawledUrls,
          robotsSitemapUrls: context.outputs.robotsTxt?.sitemapUrls,
          excludePatterns: context.options.sitemap?.excludePatterns ?? context.options.crawl?.excludePatterns,
          mismatchThresholdPercent: context.options.sitemap?.mismatchThresholdPercent,
          timeoutMs: context.options.sitemap?.timeoutMs,
        });
        context.outputs.sitemap = data;
        return {
          id: "sitemap",
          status: "success",
          data,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: "sitemap",
          status: "failure",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        };
      }
    },
  },
};

export function getCheckDefinition(id: CheckId): CheckDefinition {
  return CHECK_DEFINITIONS[id];
}

export function listChecks(): CheckDefinition[] {
  return CHECK_IDS.map((id) => CHECK_DEFINITIONS[id]);
}

export function listImplementedChecks(): CheckDefinition[] {
  return listChecks().filter((check) => check.implemented);
}

export async function runRegisteredCheck(context: CheckRunContext, id: CheckId): Promise<CheckExecutionResult> {
  return CHECK_DEFINITIONS[id].run(context);
}
