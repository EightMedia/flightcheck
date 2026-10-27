import { type CheckIssue } from "./issues.js";
export type SitemapSourceResult = {
    url: string;
    status: number | null;
    pageUrls: string[];
};
export type SitemapCheckResult = {
    sources: SitemapSourceResult[];
    sitemapPageUrls: string[];
    crawledUrls: string[];
    inSitemapNotCrawled: string[];
    crawledNotInSitemap: string[];
    mismatchPercent: number;
    issues: CheckIssue[];
};
export type AnalyzeSitemapCompareInput = {
    sources: SitemapSourceResult[];
    crawledUrls: string[];
    mismatchThresholdPercent?: number;
    excludePatterns?: string[];
};
export declare function analyzeSitemapCompare(input: AnalyzeSitemapCompareInput): SitemapCheckResult;
export declare function discoverSitemapCandidates(origin: string, robotsSitemapUrls?: string[]): string[];
export declare function loadSitemapSources(candidateUrls: string[], origin: string, timeoutMs: number): Promise<SitemapSourceResult[]>;
export type RunSitemapCheckOptions = {
    startUrl: string;
    crawledUrls: string[];
    robotsSitemapUrls?: string[];
    timeoutMs?: number;
    mismatchThresholdPercent?: number;
    excludePatterns?: string[];
};
export type SitemapCheckOptions = Pick<RunSitemapCheckOptions, "timeoutMs" | "mismatchThresholdPercent" | "excludePatterns">;
export declare function runSitemapCheck(options: RunSitemapCheckOptions): Promise<SitemapCheckResult>;
export declare function collectSitemapPageUrls(startUrl: string, timeoutMs: number, robotsSitemapUrls?: string[], customSitemapUrl?: string): Promise<string[]>;
//# sourceMappingURL=sitemap.d.ts.map