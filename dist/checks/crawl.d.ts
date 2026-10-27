import { type CheckGroup } from "../crawler/checkGroups.js";
import type { CrawlCheckResult } from "./types.js";
export type CrawlCheckOptions = {
    startUrl: string;
    outputPath?: string;
    maxPages?: number;
    delayMs?: number;
    timeoutMs?: number;
    concurrency?: number;
    burstDelayMs?: number;
    sitemapStart?: boolean;
    sitemapUrl?: string;
    excludePatterns?: string[];
    respectRobotsTxt?: boolean;
    activeGroups?: Set<CheckGroup>;
    only?: string;
    skip?: string;
    revealSecrets?: boolean;
    quiet?: boolean;
};
export declare function prepareCrawlSeedUrls(options: CrawlCheckOptions): Promise<{
    normalizedStartUrl: string;
    seedUrls: string[];
    outputPath: string;
    activeGroups: Set<CheckGroup>;
}>;
export declare function runCrawlCheck(options: CrawlCheckOptions): Promise<CrawlCheckResult>;
//# sourceMappingURL=crawl.d.ts.map