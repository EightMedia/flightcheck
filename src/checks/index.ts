import { CHECK_IDS, DEFAULT_CHECK_IDS } from "./types.js";
import { CHECK_DEFINITIONS, getCheckDefinition, listChecks, listImplementedChecks } from "./registry.js";
import { planCheckWaves, runCheck, runChecks } from "./runner.js";
import { runAnalyzeCheck } from "./analyze.js";
import { runCrawlCheck, prepareCrawlSeedUrls } from "./crawl.js";
import { analyzeDnsRecords, runDnsCheck } from "./dns.js";
import { analyzeRobotsTxt, runRobotsTxtCheck } from "./robots-txt.js";
import { analyzeSecurityHeaders, runSecurityHeadersCheck } from "./security-headers.js";
import { analyzeSitemapCompare, runSitemapCheck } from "./sitemap.js";
import {
  analyzeRedirect,
  analyzeWwwAliasRedirect,
  buildAlternateHostUrl,
  resolveCanonicalUrl,
  resolveChecksForRedirect,
  runRedirectCheck,
  toggleWwwHostname,
} from "./redirect.js";

export {
  CHECK_IDS,
  CHECK_DEFINITIONS,
  DEFAULT_CHECK_IDS,
  getCheckDefinition,
  listChecks,
  listImplementedChecks,
  planCheckWaves,
  runAnalyzeCheck,
  runCheck,
  runChecks,
  runCrawlCheck,
  prepareCrawlSeedUrls,
  analyzeDnsRecords,
  runDnsCheck,
  analyzeRobotsTxt,
  runRobotsTxtCheck,
  analyzeSecurityHeaders,
  runSecurityHeadersCheck,
  analyzeSitemapCompare,
  runSitemapCheck,
  analyzeRedirect,
  analyzeWwwAliasRedirect,
  buildAlternateHostUrl,
  resolveCanonicalUrl,
  resolveChecksForRedirect,
  runRedirectCheck,
  toggleWwwHostname,
};

export type {
  AnalyzeCheckResult,
  CheckDefinition,
  CheckExecutionResult,
  CheckId,
  CheckOutputs,
  CheckRunContext,
  CheckStatus,
  CrawlCheckResult,
  ImplementedCheckId,
  PlannedCheckId,
  RunChecksOptions,
  RunChecksResult,
} from "./types.js";

export type { AnalyzeCheckOptions } from "./analyze.js";
export type { CrawlCheckOptions } from "./crawl.js";
export type { CheckIssue, CheckIssueSeverity } from "./issues.js";
export type { DnsCheckResult } from "./dns.js";
export type { RobotsTxtCheckResult } from "./robots-txt.js";
export type { SecurityHeadersCheckResult } from "./security-headers.js";
export type { SitemapCheckResult, SitemapCheckOptions } from "./sitemap.js";
export type { RedirectCheckResult, WwwAliasRedirectProbe } from "./redirect.js";
export type { Tier1ReportData } from "../analyze/report.js";
