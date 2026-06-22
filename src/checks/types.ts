import type { VerificationRecord } from "../crawler/schema.js";
import type { DnsCheckResult } from "./dns.js";
import type { RedirectCheckResult } from "./redirect.js";
import type { RobotsTxtCheckResult } from "./robots-txt.js";
import type { SecurityHeadersCheckResult } from "./security-headers.js";
import type { SitemapCheckResult } from "./sitemap.js";

export const CHECK_IDS = ["crawl", "analyze", "lighthouse", "security-headers", "dns", "robots-txt", "sitemap"] as const;

export type CheckId = (typeof CHECK_IDS)[number];

export type ImplementedCheckId = "crawl" | "analyze" | "security-headers" | "dns" | "robots-txt" | "sitemap";

export type PlannedCheckId = Exclude<CheckId, ImplementedCheckId>;

/** Default pipeline: all implemented checks (Tier 1 infra + crawl + analyze). */
export const DEFAULT_CHECK_IDS: CheckId[] = [
  "crawl",
  "security-headers",
  "dns",
  "robots-txt",
  "sitemap",
  "analyze",
];

export type CheckStatus = "success" | "failure" | "skipped" | "unsupported";

export type CheckExecutionResult<TData = unknown> = {
  id: CheckId;
  status: CheckStatus;
  data?: TData;
  error?: string;
  durationMs: number;
};

export type CrawlCheckResult = {
  records: VerificationRecord[];
  outputPath: string;
  interrupted: boolean;
  secretsFound: number;
};

export type AnalyzeCheckResult = {
  inputPath: string;
  reportPath: string;
  manifestPath: string;
  markdown: string;
  manifest: import("../analyze/fixManifest.js").FixManifest;
  pagesAnalyzed: number;
};

export type CheckOutputs = {
  crawl?: CrawlCheckResult;
  analyze?: AnalyzeCheckResult;
  redirect?: RedirectCheckResult;
  securityHeaders?: SecurityHeadersCheckResult;
  dns?: DnsCheckResult;
  robotsTxt?: RobotsTxtCheckResult;
  sitemap?: SitemapCheckResult;
};

export type CheckDefinition<TData = unknown> = {
  id: CheckId;
  name: string;
  description: string;
  dependencies: CheckId[];
  implemented: boolean;
  run: (context: CheckRunContext) => Promise<CheckExecutionResult<TData>>;
};

export type CheckRunContext = {
  startUrl: string;
  outputs: CheckOutputs;
  options: RunChecksOptions;
};

export type RunChecksOptions = {
  startUrl: string;
  checks?: CheckId[];
  parallel?: boolean;
  crawl?: import("./crawl.js").CrawlCheckOptions;
  analyze?: import("./analyze.js").AnalyzeCheckOptions;
  sitemap?: import("./sitemap.js").SitemapCheckOptions;
};

export type RunChecksResult = {
  results: CheckExecutionResult[];
  outputs: CheckOutputs;
  redirectOnly: boolean;
};
