import { CheerioCrawler, RequestQueue } from "crawlee";
import pino from "pino";
import {
  DEFAULT_BURST_DELAY_MS,
  DEFAULT_CONCURRENCY,
  DEFAULT_DELAY_MS,
  DEFAULT_MAX_PAGES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./defaults.js";
import { CHECK_GROUPS, type CheckGroup } from "./checkGroups.js";
import { extractInternalLinks, extractVerificationRecord } from "./extractors.js";
import { extractSameOriginScripts } from "./jsAssets.js";
import { loadRobotsPolicy } from "./robots.js";
import { writeReportToFile } from "./reporter.js";
import { scanText } from "./secrets.js";
import type { SecretFinding, VerificationRecord } from "./schema.js";
import { matchesExcludePattern, normalizeUrl, sleep } from "./urlUtils.js";

const MAX_JS_ASSET_BYTES = 5_000_000; // 5 MB — skip larger bundles to bound memory

export type RunCrawlerOptions = {
  startUrl: string;
  outputPath: string;
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  concurrency?: number;
  burstDelayMs?: number;
  seedUrls?: string[];
  excludePatterns?: string[];
  respectRobotsTxt?: boolean;
  activeGroups?: Set<CheckGroup>;
  revealSecrets?: boolean;
};

export async function runCrawler(options: RunCrawlerOptions): Promise<{ records: VerificationRecord[]; interrupted: boolean }> {
  const logger = pino({ level: "info" });
  const startUrl = normalizeUrl(options.startUrl);
  const origin = new URL(startUrl).origin;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const burstDelayMs = options.burstDelayMs ?? DEFAULT_BURST_DELAY_MS;
  const excludePatterns = options.excludePatterns ?? [];
  const seedUrls = (options.seedUrls ?? [startUrl]).map((url) => normalizeUrl(url));
  const respectRobotsTxt = options.respectRobotsTxt ?? false;
  const activeGroups = options.activeGroups ?? new Set<CheckGroup>(CHECK_GROUPS);
  const revealSecrets = options.revealSecrets ?? false;
  const jsScanCache = new Map<string, SecretFinding[]>();
  const failedAssets = new Set<string>();

  const fetchText = async (assetUrl: string): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(assetUrl, {
        signal: controller.signal,
        headers: { "user-agent": DEFAULT_USER_AGENT },
      });
      if (!res.ok) return null;
      const contentLength = Number(res.headers.get("content-length") ?? "0");
      if (contentLength > MAX_JS_ASSET_BYTES) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const scanSecurity = async (
    html: string,
    pageUrl: string
  ): Promise<{ secrets: SecretFinding[]; scannedAssets: number }> => {
    const secrets: SecretFinding[] = [...scanText(html, "html", revealSecrets)];
    const scripts = extractSameOriginScripts(html, pageUrl, origin);
    let scannedAssets = 0;
    for (const scriptUrl of scripts) {
      if (failedAssets.has(scriptUrl)) continue;
      let assetFindings = jsScanCache.get(scriptUrl);
      if (!assetFindings) {
        const js = await fetchText(scriptUrl);
        if (js === null) { failedAssets.add(scriptUrl); continue; }
        assetFindings = scanText(js, scriptUrl, revealSecrets);
        jsScanCache.set(scriptUrl, assetFindings);
      }
      scannedAssets += 1;
      secrets.push(...assetFindings);
    }
    return { secrets, scannedAssets };
  };

  const robotsPolicy = respectRobotsTxt ? await loadRobotsPolicy(origin, timeoutMs) : null;

  const requestQueue = await RequestQueue.open();
  const records: VerificationRecord[] = [];
  const seen = new Set<string>();

  for (const seed of seedUrls) {
    if (!matchesExcludePattern(seed, excludePatterns)) {
      await requestQueue.addRequest({ url: seed, uniqueKey: normalizeUrl(seed) });
      seen.add(normalizeUrl(seed));
    }
  }

  let processedSinceBurst = 0;
  let interrupted = false;

  const persist = (): VerificationRecord[] => {
    writeReportToFile(records, options.outputPath);
    return records;
  };

  process.on("SIGINT", async () => {
    interrupted = true;
    logger.info("[crawl] SIGINT ontvangen, graceful stop gestart");
  });

  logger.info(
    `[crawl] start url=${startUrl} output=${options.outputPath} maxPages=${maxPages} concurrency=${concurrency} delayMs=${delayMs} burstDelayMs=${burstDelayMs} timeoutMs=${timeoutMs} seeds=${seedUrls.length} respectRobotsTxt=${respectRobotsTxt}`
  );

  const crawler = new CheerioCrawler({
    requestQueue,
    maxRequestsPerCrawl: maxPages,
    maxConcurrency: concurrency,
    // +60 s headroom when security scanning is active: the handler does sequential JS fetches
    // per page; the failedAssets/jsScanCache ensures dead/cached assets aren't re-fetched.
    requestHandlerTimeoutSecs: Math.ceil(timeoutMs / 1000) + (activeGroups.has("security") ? 60 : 0),
    requestHandler: async ({ request, body, contentType, enqueueLinks, response }) => {
      if (interrupted) return;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      if (burstDelayMs > 0 && processedSinceBurst > 0 && processedSinceBurst % concurrency === 0) {
        await sleep(burstDelayMs);
      }
      const currentUrl = normalizeUrl(request.loadedUrl ?? request.url);
      if (robotsPolicy && !robotsPolicy.isAllowed(currentUrl)) {
        const skipped = extractVerificationRecord("", currentUrl, null, "");
        skipped.note = "Skipped by robots.txt policy";
        records.push(skipped);
        const currentRecords = persist();
        processedSinceBurst += 1;
        logger.info(`[crawl] processed=${currentRecords.length} url=${currentUrl} status=robots-blocked`);
        return;
      }
      const html = typeof body === "string" ? body : "";
      const status = response?.statusCode ?? null;
      const effectiveContentType = contentType?.type ?? "";

      const record = extractVerificationRecord(html, currentUrl, status, effectiveContentType, activeGroups);
      if (activeGroups.has("security") && effectiveContentType.includes("text/html") && html) {
        record.security = await scanSecurity(html, currentUrl);
      }
      records.push(record);
      const currentRecords = persist();
      processedSinceBurst += 1;
      logger.info(`[crawl] processed=${currentRecords.length} url=${currentUrl} status=${status ?? "error"}`);

      if (effectiveContentType.includes("text/html")) {
        const links = extractInternalLinks(html, currentUrl, origin);
        for (const link of links) {
          const normalized = normalizeUrl(link);
          if (seen.has(normalized)) continue;
          if (matchesExcludePattern(normalized, excludePatterns)) continue;
          if (robotsPolicy && !robotsPolicy.isAllowed(normalized)) continue;
          seen.add(normalized);
          await requestQueue.addRequest({ url: normalized, uniqueKey: normalized });
        }
      }

      await enqueueLinks({ strategy: "same-hostname" });
    },
    failedRequestHandler: async ({ request, error }) => {
      const currentUrl = normalizeUrl(request.loadedUrl ?? request.url);
      const record = extractVerificationRecord("", currentUrl, null, "");
      record.error = error instanceof Error ? error.message : "Unknown error";
      records.push(record);
      const currentRecords = persist();
      logger.info(`[crawl] processed=${currentRecords.length} url=${currentUrl} status=error`);
    },
  });

  await crawler.run();

  const finalRecords = persist();
  logger.info(`[crawl] klaar pages=${finalRecords.length} interrupted=${interrupted}`);
  return { records: finalRecords, interrupted };
}
